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
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareTestEnv,
    );
    const [user1] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));

    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
    });

    const tokenId = await fundSwapOrderManager.tokenOfOwnerByIndex(user1.getAddress(), 0);
    const order = await fundSwapOrderManager.getOrder(tokenId);
    expect(await fundSwapOrderManager.balanceOf(user1.getAddress())).to.equal(1);
    expect(order.offeredToken).to.equal(await erc20Token.getAddress());
    expect(order.amountOffered).to.equal(ethers.parseEther('1'));
    expect(order.wantedToken).to.equal(await wmaticToken.getAddress());
    expect(order.amountWanted).to.equal(ethers.parseEther('1'));
    expect(order.deadline).to.equal(0);
  });
  it('Should allow to cancel a public order with withdrawal of offered tokens', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareTestEnv,
    );
    const [user1] = await ethers.getSigners();

    const balanceBeforeOrderCreation = await erc20Token.balanceOf(user1.getAddress());

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
    });
    const balanceAfterOrderCreation = await erc20Token.balanceOf(user1.getAddress());

    await fundSwap.cancelOrder(0);
    const balanceAfterOrderCancellation = await erc20Token.balanceOf(user1.getAddress());
    expect(await fundSwapOrderManager.balanceOf(await user1.getAddress())).to.equal(0);
    expect(balanceBeforeOrderCreation).to.equal(balanceAfterOrderCancellation);
    expect(balanceAfterOrderCreation).to.be.lessThan(balanceAfterOrderCancellation);
  });

  it('Should allow to fill a particular public order', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareTestEnv,
    );
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.getAddress());

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

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

  it('Should allow to fill by market with exact amount of input tokens', async () => {
    const {
      fundSwap,
      fundSwapOrderManager,
      fundSwapBatchExecutor,
      erc20Token,
      wmaticToken,
    } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.getAddress());

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('3'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('2'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwapBatchExecutor.getAddress(), ethers.parseEther('1.5'));

    await fundSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('1'),
      },
      {
        orderId: 1,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.003'); // 1 * 0.24%

    expect(erc20User1BalanceBefore - ethers.parseEther('3')).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(erc20User2BalanceBefore + ethers.parseEther('1.25') - FEE).to.be.equal(
      erc20User2BalanceAfter,
    );
    expect(wethUser1BalanceBefore + ethers.parseEther('1.5')).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore - ethers.parseEther('1.5')).to.be.equal(
      wethUser2BalanceAfter,
    );

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await fundSwapOrderManager.getOrder(1);
    expect(remainingOrder.amountOffered).to.be.equal(ethers.parseEther('1.75'));
    expect(remainingOrder.amountWanted).to.be.equal(ethers.parseEther('3.5'));
  });

  it('Should allow to fill by market when tokens have different decimals', async () => {
    const {
      fundSwap,
      fundSwapOrderManager,
      fundSwapBatchExecutor,
      erc20Token,
      usdcToken,
    } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const usdcUser1BalanceBefore = await usdcToken.balanceOf(user1.getAddress());
    const usdcUser2BalanceBefore = await usdcToken.balanceOf(user2.getAddress());

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('3'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: usdcToken.getAddress(),
      amountWanted: ethers.parseUnits('100', 6),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('2'),
      wantedToken: usdcToken.getAddress(),
      amountWanted: ethers.parseUnits('400', 6),
      deadline: 0,
    });

    await usdcToken
      .connect(user2)
      .approve(fundSwapBatchExecutor.getAddress(), ethers.parseUnits('150', 6));

    await fundSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseUnits('100', 6),
      },
      {
        orderId: 1,
        amountIn: ethers.parseUnits('50', 6),
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.getAddress());
    const usdcUser1BalanceAfter = await usdcToken.balanceOf(user1.getAddress());
    const usdcUser2BalanceAfter = await usdcToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.003'); // 1.25 * 0.24%

    expect(erc20User1BalanceAfter).to.be.equal(
      erc20User1BalanceBefore - ethers.parseEther('3'),
    );
    expect(erc20User2BalanceAfter).to.be.equal(
      erc20User2BalanceBefore + ethers.parseEther('1.25') - FEE,
    );
    expect(usdcUser1BalanceAfter).to.be.equal(
      usdcUser1BalanceBefore + ethers.parseUnits('150', 6),
    );
    expect(usdcUser2BalanceAfter).to.be.equal(
      usdcUser2BalanceBefore - ethers.parseUnits('150', 6),
    );

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await fundSwapOrderManager.getOrder(1);
    expect(remainingOrder.amountOffered).to.be.equal(ethers.parseEther('1.75'));
    expect(remainingOrder.amountWanted).to.be.equal(ethers.parseUnits('350', 6));
  });

  it('Fill partially a single order', async () => {
    const {
      fundSwap,
      fundSwapOrderManager,
      fundSwapBatchExecutor,
      erc20Token,
      wmaticToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwapBatchExecutor.getAddress(), ethers.parseEther('1'));

    await fundSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.parseEther('0.5'));
    expect(order.amountWanted).to.be.equal(ethers.parseEther('0.5'));
  });

  it('Fill partially a single order when tokens have different decimals', async () => {
    const {
      fundSwap,
      fundSwapOrderManager,
      fundSwapBatchExecutor,
      erc20Token,
      usdcToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: usdcToken.getAddress(),
      amountWanted: ethers.parseUnits('100', 6),
      deadline: 0,
    });

    await usdcToken
      .connect(user2)
      .approve(fundSwapBatchExecutor.getAddress(), ethers.parseUnits('100', 6));

    await fundSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseUnits('50', 6),
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.parseEther('0.5'));
    expect(order.amountWanted).to.be.equal(ethers.parseUnits('50', 6));
  });

  it('Fill partially a single order when tokens have different decimals and base asset has 6 decimals', async () => {
    const {
      fundSwap,
      fundSwapOrderManager,
      fundSwapBatchExecutor,
      erc20Token,
      usdcToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await usdcToken.approve(fundSwap.getAddress(), ethers.parseUnits('200', 6));
    await fundSwap.createPublicOrder({
      offeredToken: usdcToken.getAddress(),
      amountOffered: ethers.parseUnits('200', 6),
      wantedToken: erc20Token.getAddress(),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
    });

    await erc20Token
      .connect(user2)
      .approve(fundSwapBatchExecutor.getAddress(), ethers.parseEther('0.5'));

    await fundSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.parseUnits('100', 6));
    expect(order.amountWanted).to.be.equal(ethers.parseEther('0.5'));
    expect(await usdcToken.balanceOf(fundSwap.getAddress())).to.be.equal(
      ethers.parseUnits('100.24', 6), //remaining 100 USDC is still on the contract balance
    );
  });

  it('Fill single order with not even amounts (tests precision)', async () => {
    const {
      fundSwap,
      fundSwapOrderManager,
      fundSwapBatchExecutor,
      erc20Token,
      wmaticToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1.25'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1.25'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('1.4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwapBatchExecutor.getAddress(), ethers.parseEther('0.5'));

    await fundSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.parseEther('0.803571428571428571'));
    expect(order.amountWanted).to.be.equal(ethers.parseEther('0.9'));
  });

  it('Should return an empty list when there are no orders for a given pair', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('2'));
    expect(
      await fundSwap.getOrdersForPair(erc20Token.getAddress(), wmaticToken.getAddress()),
    ).to.be.deep.equal([]);
  });

  it('should not allow to create an order when offered and wanted tokens are the same', async () => {
    const { fundSwap, erc20Token } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.getAddress(),
        amountOffered: ethers.parseEther('1'),
        wantedToken: erc20Token.getAddress(),
        amountWanted: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__InvalidPath');
  });

  it('should not allow to create an order when offered or wanted amount is zero', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.getAddress(),
        amountOffered: 0,
        wantedToken: wmaticToken.getAddress(),
        amountWanted: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__OfferedAmountIsZero');
    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.getAddress(),
        amountOffered: ethers.parseEther('1'),
        wantedToken: wmaticToken.getAddress(),
        amountWanted: 0,
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__WantedAmountIsZero');
  });

  it('should allow to transfer ownership of the public order to another address', async () => {
    const {
      fundSwap,
      erc20Token,
      wmaticToken,
      fundSwapOrderManager,
      fundSwapBatchExecutor,
    } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
    });

    const [user1, user2] = await ethers.getSigners();
    await fundSwapOrderManager.transferFrom(user1.getAddress(), user2.getAddress(), 0);
    expect(await fundSwapOrderManager.ownerOf(0)).to.be.equal(await user2.getAddress());

    const wmaticBalanceOfFirstUserBefore = await wmaticToken.balanceOf(
      user1.getAddress(),
    );
    const wmaticBalanceOfSecondUserBefore = await wmaticToken.balanceOf(
      user2.getAddress(),
    );

    await wmaticToken
      .connect(user2)
      .approve(fundSwapBatchExecutor.getAddress(), ethers.parseEther('1'));
    await fundSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('1'),
      },
    ]);

    const wmaticBalanceOfFirstUserAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wmaticBalanceOfSecondUserAfter = await wmaticToken.balanceOf(
      user2.getAddress(),
    );

    expect(wmaticBalanceOfFirstUserAfter).to.be.equal(wmaticBalanceOfFirstUserBefore);
    // should be the same as second user is now the owner of the order
    expect(wmaticBalanceOfSecondUserAfter).to.be.equal(wmaticBalanceOfSecondUserBefore);
  });
});
