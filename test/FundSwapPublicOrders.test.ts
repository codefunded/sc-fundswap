import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('PublicOrders', () => {
  it('Should deploy FundSwap and FundSwapOrderManager', async () => {
    const { fundSwap, fundSwapOrderManager } = await loadFixture(prepareTestEnv);

    expect(await fundSwap.getAddress()).to.be.properAddress;
    expect(await fundSwapOrderManager.getAddress()).to.be.properAddress;
  });

  it('Should allow to create a public order', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));

    await fundSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      creationTimestamp: 0,
    });

    const tokenId = await fundSwapOrderManager.tokenOfOwnerByIndex(user1.getAddress(), 0);
    const order = await fundSwapOrderManager.getOrder(
      await fundSwapOrderManager.tokenIdToOrderHash(tokenId),
    );
    expect(await fundSwapOrderManager.balanceOf(user1.getAddress())).to.equal(1);
    expect(order.makerSellToken).to.equal(await erc20Token.getAddress());
    expect(order.makerSellTokenAmount).to.equal(ethers.parseEther('1'));
    expect(order.makerBuyToken).to.equal(await wmaticToken.getAddress());
    expect(order.makerBuyTokenAmount).to.equal(ethers.parseEther('1'));
    expect(order.deadline).to.equal(0);
  });

  it('Should allow to cancel a public order with withdrawal of the maker sell tokens', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1] = await ethers.getSigners();

    const balanceBeforeOrderCreation = await erc20Token.balanceOf(user1.getAddress());

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      creationTimestamp: 0,
    });
    const balanceAfterOrderCreation = await erc20Token.balanceOf(user1.getAddress());

    await fundSwap.cancelOrder(await fundSwapOrderManager.tokenIdToOrderHash(0));
    const balanceAfterOrderCancellation = await erc20Token.balanceOf(user1.getAddress());
    expect(await fundSwapOrderManager.balanceOf(await user1.getAddress())).to.equal(0);
    expect(balanceBeforeOrderCreation).to.equal(balanceAfterOrderCancellation);
    expect(balanceAfterOrderCreation).to.be.lessThan(balanceAfterOrderCancellation);
  });

  it('should not allow reentrancy when cancelling a public order', async () => {
    const { fundSwap, fundSwapOrderManager, wmaticToken, tokenWhitelistPlugin } =
      await loadFixture(prepareTestEnv);

    const ReentrantERC20Factory = await ethers.getContractFactory('ReentrantERC20');
    const reentrantERC20 = await ReentrantERC20Factory.deploy(fundSwap.getAddress());

    await tokenWhitelistPlugin.addTokenToWhitelist(reentrantERC20.getAddress());

    await reentrantERC20.approve(fundSwap.getAddress(), ethers.parseEther('10'));
    await fundSwap.createPublicOrder({
      makerSellToken: reentrantERC20.getAddress(),
      makerSellTokenAmount: ethers.parseEther('10'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      creationTimestamp: 0,
    });

    await expect(
      fundSwap.cancelOrder(await fundSwapOrderManager.tokenIdToOrderHash(0)),
    ).to.be.revertedWithCustomError(fundSwap, 'ReentrancyGuardReentrantCall');
  });

  it('Should allow to fill a particular public order', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.getAddress());

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      creationTimestamp: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap
      .connect(user2)
      .fillPublicOrder(
        await fundSwapOrderManager.tokenIdToOrderHash(0),
        user2.getAddress(),
      );

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.0024'); // 1 * 0.24%

    expect(await fundSwapOrderManager.totalSupply()).to.equal(0);
    expect(erc20User1BalanceBefore - ethers.parseEther('1')).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(erc20User2BalanceBefore + ethers.parseEther('1') - FEE).to.be.equal(
      erc20User2BalanceAfter,
    );
    expect(wethUser1BalanceBefore + ethers.parseEther('1')).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore - ethers.parseEther('1')).to.be.equal(
      wethUser2BalanceAfter,
    );
    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(FEE);
  });

  it('Should not allow to fully fill a public order with partialFill function', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      creationTimestamp: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await expect(
      fundSwap.connect(user2).fillPublicOrderPartially(
        {
          orderHash: await fundSwapOrderManager.tokenIdToOrderHash(0),
          amountIn: ethers.parseEther('1'),
          minAmountOut: 0,
        },
        user2.getAddress(),
      ),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__AmountInExceededLimit');
  });

  it('should revert if the amount of tokens received when creating a public order is less than the specified amount (transfer fee tokens)', async () => {
    const { fundSwap, wmaticToken, tokenWhitelistPlugin } =
      await loadFixture(prepareTestEnv);

    const TransferFeeTokenMockFactory =
      await ethers.getContractFactory('TransferFeeTokenMock');

    const transferFeeTokenMock = await TransferFeeTokenMockFactory.deploy(
      'TransferFeeTokenMock',
      'TFTM',
      ethers.parseEther('10'),
    );

    await tokenWhitelistPlugin.addTokenToWhitelist(transferFeeTokenMock.getAddress());

    await transferFeeTokenMock.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await expect(
      fundSwap.createPublicOrder({
        makerSellToken: transferFeeTokenMock.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticToken.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
        creationTimestamp: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__TransferFeeTokensNotSupported');
  });

  it('should revert if there already is an order with the same hash', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('2'));
    await fundSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      creationTimestamp: 0,
    });
    await expect(
      fundSwap.createPublicOrder({
        makerSellToken: erc20Token.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticToken.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
        creationTimestamp: 0,
      }),
    ).to.be.revertedWithCustomError(
      fundSwapOrderManager,
      'FundSwapOrderManager__OrderAlreadyExists',
    );

    await expect(
      fundSwap.createPublicOrder({
        makerSellToken: erc20Token.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticToken.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
        creationTimestamp: 1123123123, // different timestamp as nonce
      }),
    ).not.to.be.reverted;
  });
});
