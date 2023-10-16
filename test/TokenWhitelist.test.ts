import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { expect } from 'chai';
import { hashOrder } from '../utils/testHelpers/hashOrder';
import { ethers } from 'hardhat';

describe('TokenWhitelist', () => {
  it('owner should be allowed to whitelist a token', async () => {
    const { fundSwap } = await loadFixture(prepareTestEnv);

    await fundSwap.addTokenToWhitelist(ethers.ZeroAddress);
    const whitelistedTokens = await fundSwap.getWhitelistedTokens();
    expect(whitelistedTokens).to.include(ethers.ZeroAddress);
    expect(whitelistedTokens.length).to.be.equal(4);
  });

  it('owner should be allowed to remove a token from whitelist', async () => {
    const { fundSwap, erc20Token } = await loadFixture(prepareTestEnv);

    await fundSwap.removeTokenFromWhitelist(erc20Token.getAddress());
    const whitelistedTokens = await fundSwap.getWhitelistedTokens();
    expect(whitelistedTokens).to.not.include(erc20Token.getAddress());
    expect(whitelistedTokens.length).to.be.equal(2);
  });

  it('should allow to get the list of whitelisted tokens', async () => {
    const { fundSwap, erc20Token, wmaticToken, usdcToken } = await loadFixture(
      prepareTestEnv,
    );

    const whitelistedTokens = await fundSwap.getWhitelistedTokens();
    expect(whitelistedTokens).to.contain.members([
      await erc20Token.getAddress(),
      await wmaticToken.getAddress(),
      await usdcToken.getAddress(),
    ]);
  });

  it('should not allow to create a public order for a token that is not whitelisted', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await fundSwap.removeTokenFromWhitelist(erc20Token.getAddress());

    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.getAddress(),
        amountOffered: ethers.parseEther('1'),
        wantedToken: wmaticToken.getAddress(),
        amountWanted: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');

    await expect(
      fundSwap.createPublicOrder({
        offeredToken: wmaticToken.getAddress(),
        amountOffered: ethers.parseEther('1'),
        wantedToken: erc20Token.getAddress(),
        amountWanted: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');
  });

  it('should not allow to fill a public order with tokens that are not whitelisted', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      amountOffered: ethers.parseEther('1'),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
      offeredToken: erc20Token.getAddress(),
      wantedToken: wmaticToken.getAddress(),
    });

    await fundSwap.removeTokenFromWhitelist(erc20Token.getAddress());

    await expect(
      fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress()),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');
  });

  it('should not allow to fill a private order with tokens that are not on whitelist', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await fundSwap.removeTokenFromWhitelist(erc20Token.getAddress());

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    const order = {
      amountOffered: ethers.parseEther('1'),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
      offeredToken: await erc20Token.getAddress(),
      wantedToken: await wmaticToken.getAddress(),
      creator: await user1.getAddress(),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };
    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));

    await expect(
      fundSwap.connect(user2).fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');
  });

  it('should allow to cancel a public order even when tokens are no longer on the whitelist', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      amountOffered: ethers.parseEther('1'),
      amountWanted: ethers.parseEther('1'),
      deadline: 0,
      offeredToken: erc20Token.getAddress(),
      wantedToken: wmaticToken.getAddress(),
    });

    await fundSwap.removeTokenFromWhitelist(erc20Token.getAddress());

    await fundSwap.cancelOrder(0);
  });
});
