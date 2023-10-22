import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('FundSwapOrderManager', () => {
  it('should return tokenURI', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareTestEnv,
    );

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 1337,
    });

    const tokenURI = await fundSwapOrderManager.tokenURI(0);
    // remove base64 encoding
    const decodedTokenURI = Buffer.from(tokenURI.split(',')[1], 'base64').toString(
      'ascii',
    );

    const tokenMetadata = JSON.parse(decodedTokenURI);
    expect(tokenMetadata.name).to.equal(
      '1000000000000000000 MET => 2000000000000000000 WMATIC',
    );
    expect(tokenMetadata.attributes).to.deep.equal([
      { trait_type: 'Deadline', value: '1337' },
    ]);
  });
});
