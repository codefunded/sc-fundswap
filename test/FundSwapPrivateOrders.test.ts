import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { hashOrder } from '../utils/testHelpers/hashOrder';
import { MAX_UINT256 } from '../utils/constants';
import { getPermitSignature } from '../utils/testHelpers/permit';

describe('PrivateOrders', () => {
  it('Create private order should correctly hash message', async () => {
    const { privateOrderExecutor, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();
    const order = {
      nonce: '0',
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };
    const hashedOrderInContract = await privateOrderExecutor.createPrivateOrder(order);

    const hashedOrderInEthers = hashOrder(order);
    expect(hashedOrderInContract).to.equal(hashedOrderInEthers);
  });

  it('Should not allow recipient to modify the order', async () => {
    const { privateOrderExecutor, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const order = {
      nonce: '0',
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    const modifiedOrder = {
      ...order,
      makerSellTokenAmount: ethers.parseEther('2'),
    };
    const modifiedOrderHash = hashOrder(order);

    await expect(
      privateOrderExecutor.fillPrivateOrder(modifiedOrder, modifiedOrderHash, signature),
    ).to.be.revertedWithCustomError(
      privateOrderExecutor,
      'OrderSignatureVerifier__InvalidOrderHash',
    );
  });

  it('Should correctly verify the signature', async () => {
    const { privateOrderExecutor, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const order = {
      nonce: '0',
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));
    const isSignedByMaker = await privateOrderExecutor.verifyOrder(
      order,
      orderHash,
      signature,
    );

    expect(isSignedByMaker).to.equal(true);
    expect(await user1.getAddress()).to.equal(order.maker);

    const wrongSignature = await user2.signMessage(ethers.getBytes(orderHash));
    const wrongSignatureVerificationResult = await privateOrderExecutor.verifyOrder(
      order,
      orderHash,
      wrongSignature,
    );
    expect(wrongSignatureVerificationResult).to.equal(false);
  });

  it('Should allow to fill private order', async () => {
    const { privateOrderExecutor, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    // user1 has all erc20 tokens and user2 has all wmatic tokens
    await erc20Token
      .connect(user2)
      .transfer(await user1.getAddress(), await erc20Token.balanceOf(user2.getAddress()));
    await wmaticToken
      .connect(user1)
      .transfer(
        await user2.getAddress(),
        await wmaticToken.balanceOf(user1.getAddress()),
      );

    await erc20Token.approve(privateOrderExecutor.getAddress(), ethers.parseEther('1'));

    const order = {
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    await wmaticToken
      .connect(user2)
      .approve(privateOrderExecutor.getAddress(), ethers.parseEther('1'));

    await privateOrderExecutor
      .connect(user2)
      .fillPrivateOrder(order, orderHash, signature);

    expect(await wmaticToken.balanceOf(user1.getAddress())).to.be.greaterThan(0);
    expect(await erc20Token.balanceOf(user2.getAddress())).to.be.greaterThan(0);
  });

  it('Should allow to fill private order with permit', async () => {
    const { privateOrderExecutor, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    // user1 has all erc20 tokens and user2 has all wmatic tokens
    await erc20Token
      .connect(user2)
      .transfer(await user1.getAddress(), await erc20Token.balanceOf(user2.getAddress()));
    await wmaticToken
      .connect(user1)
      .transfer(
        await user2.getAddress(),
        await wmaticToken.balanceOf(user1.getAddress()),
      );

    await erc20Token.approve(privateOrderExecutor.getAddress(), ethers.parseEther('1'));

    const order = {
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    const deadline = MAX_UINT256;
    const { v, r, s } = await getPermitSignature(
      user2,
      wmaticToken,
      await privateOrderExecutor.getAddress(),
      ethers.parseEther('1'),
    );

    await privateOrderExecutor
      .connect(user2)
      .fillPrivateOrderWithPermit(order, orderHash, signature, deadline, v, r, s);

    expect(await wmaticToken.balanceOf(user1.getAddress())).to.be.greaterThan(0);
    expect(await erc20Token.balanceOf(user2.getAddress())).to.be.greaterThan(0);
  });

  it('Should not allow other users to accept a private order', async () => {
    const { fundSwap, privateOrderExecutor, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));

    const order = {
      nonce: '0',
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    await wmaticToken.approve(fundSwap.getAddress(), ethers.parseEther('1'));

    await expect(
      privateOrderExecutor.fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__YouAreNotARecipient');
  });

  it('Private swaps should work with tokens that have different decimal values', async () => {
    const { privateOrderExecutor, feeAggregatorPlugin, erc20Token, usdcToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(privateOrderExecutor.getAddress(), ethers.parseEther('1'));

    const order = {
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('100', 6), // USDC decimals are 6
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    await usdcToken
      .connect(user2)
      .approve(privateOrderExecutor.getAddress(), ethers.parseUnits('100', 6));

    await erc20Token
      .connect(user2)
      .transfer(
        privateOrderExecutor.getAddress(),
        await erc20Token.balanceOf(user2.getAddress()),
      );
    await usdcToken
      .connect(user1)
      .transfer(
        privateOrderExecutor.getAddress(),
        await usdcToken.balanceOf(user1.getAddress()),
      );

    await privateOrderExecutor
      .connect(user2)
      .fillPrivateOrder(order, orderHash, signature);

    expect(await usdcToken.balanceOf(user1.getAddress())).to.be.equal(
      ethers.parseUnits('100', 6),
    );
    const feeAmount =
      (ethers.parseEther('1') * (await feeAggregatorPlugin.defaultFee())) / 10000n;
    expect(await erc20Token.balanceOf(user2.getAddress())).to.be.equal(
      ethers.parseEther('1') - feeAmount,
    );
  });

  it('Should not allow to fill the same private order multiple times', async () => {
    const { privateOrderExecutor, feeAggregatorPlugin, erc20Token, usdcToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(privateOrderExecutor.getAddress(), ethers.parseEther('1'));

    const order = {
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('100', 6), // USDC decimals are 6
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    await usdcToken
      .connect(user2)
      .approve(privateOrderExecutor.getAddress(), ethers.parseUnits('100', 6));

    await erc20Token
      .connect(user2)
      .transfer(
        privateOrderExecutor.getAddress(),
        await erc20Token.balanceOf(user2.getAddress()),
      );
    await usdcToken
      .connect(user1)
      .transfer(
        privateOrderExecutor.getAddress(),
        await usdcToken.balanceOf(user1.getAddress()),
      );

    await privateOrderExecutor
      .connect(user2)
      .fillPrivateOrder(order, orderHash, signature);

    expect(await usdcToken.balanceOf(user1.getAddress())).to.be.equal(
      ethers.parseUnits('100', 6),
    );

    const feeAmount =
      (ethers.parseEther('1') * (await feeAggregatorPlugin.defaultFee())) / 10000n;
    expect(await erc20Token.balanceOf(user2.getAddress())).to.be.equal(
      ethers.parseEther('1') - feeAmount,
    );

    await expect(
      privateOrderExecutor.connect(user2).fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(
      privateOrderExecutor,
      'FundSwap__OrderHaveAlreadyBeenExecuted',
    );
  });

  it('should allow to invalidate a private order', async () => {
    const { fundSwap, privateOrderExecutor, erc20Token, usdcToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));

    const order = {
      maker: await user1.getAddress(),
      deadline: Math.floor(Date.now() / 1000) + 60,
      makerSellToken: await erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: await usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('100', 6), // USDC decimals are 6
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    await usdcToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseUnits('100', 6));

    await erc20Token
      .connect(user2)
      .transfer(fundSwap.getAddress(), await erc20Token.balanceOf(user2.getAddress()));
    await usdcToken
      .connect(user1)
      .transfer(fundSwap.getAddress(), await usdcToken.balanceOf(user1.getAddress()));

    await expect(
      privateOrderExecutor.connect(user2).invalidatePrivateOrder(order),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__NotAnOwner');

    await privateOrderExecutor.invalidatePrivateOrder(order);

    await expect(
      privateOrderExecutor.connect(user2).fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__OrderHaveAlreadyBeenExecuted');
  });
});
