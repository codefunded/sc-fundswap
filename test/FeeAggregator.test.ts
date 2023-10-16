import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { expect } from 'chai';
import { DEFAULT_FEE, MAX_UINT256 } from '../utils/constants';

describe('FeeAggregator', () => {
  it('should allow to get current fee value in basis points', async () => {
    const { fundSwap } = await loadFixture(prepareTestEnv);

    const currentFee = await fundSwap.defaultFee();
    expect(currentFee).to.equal(DEFAULT_FEE);
    const maxFee = await fundSwap.MAX_FEE();
    expect(maxFee).to.equal(10000);
  });

  it('should assign the owner', async () => {
    const { fundSwap } = await loadFixture(prepareTestEnv);
    const [owner] = await ethers.getSigners();

    const contractOwner = await fundSwap.owner();
    expect(contractOwner).to.equal(await owner.getAddress());
  });

  it('owner should be allowed to set a new fee value', async () => {
    const { fundSwap } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();
    const fundSwapOwner = await fundSwap.owner();
    expect(fundSwapOwner).to.equal(await user1.getAddress());

    await fundSwap.setDefaultFee(100);
    const currentFee = await fundSwap.defaultFee();
    expect(currentFee).to.equal(100);

    await expect(fundSwap.connect(user2).setDefaultFee(100)).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );
  });

  it('should accrue fees when public market order is executed', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.0024'),
    );
  });

  it('owner should be allowed to withdraw fees', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    const user1BalanceBeforeSwap = await erc20Token.balanceOf(user1.getAddress());

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.0024'),
    );

    await fundSwap.withdrawFees(erc20Token.getAddress(), MAX_UINT256);

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0'),
    );
    expect(await erc20Token.balanceOf(user1.getAddress())).to.equal(
      ethers.parseEther('0.0024') + user1BalanceBeforeSwap,
    );
  });

  it('should allow owner to set a fee for a specific token', async () => {
    const { fundSwap, erc20Token, wmaticToken, usdcToken } = await loadFixture(
      prepareTestEnv,
    );
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.setFeeForAsset(erc20Token.getAddress(), 100);

    await fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.01'),
    );

    await usdcToken.approve(fundSwap.getAddress(), ethers.parseUnits('1', 6));
    await fundSwap.createPublicOrder({
      offeredToken: usdcToken.getAddress(),
      amountOffered: ethers.parseUnits('1', 6),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(1, user2.getAddress());

    // default fee is 0.24%, if not set for a specific token
    expect(await usdcToken.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseUnits('0.0024', 6),
    );
  });

  it('should allow to get all fees set for all tokens', async () => {
    const { fundSwap, erc20Token, usdcToken } = await loadFixture(prepareTestEnv);

    await fundSwap.setFeeForAsset(erc20Token.getAddress(), 100);
    await fundSwap.setFeeForAsset(usdcToken.getAddress(), 200);

    const fees = await fundSwap.getFeesForAllAssets();

    expect(fees.assets[0]).to.equal(await erc20Token.getAddress());
    expect(fees.fees[0]).to.equal(100);
    expect(fees.assets[1]).to.equal(await usdcToken.getAddress());
    expect(fees.fees[1]).to.equal(200);
  });

  it('should allow to disable swap fee by setting the fee to 0', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await fundSwap.setFeeForAsset(erc20Token.getAddress(), 0);

    const fees = await fundSwap.getFeesForAllAssets();
    expect(fees.assets[0]).to.equal(await erc20Token.getAddress());
    expect(fees.fees[0]).to.equal(0);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(0);
  });

  it('should allow to set a fee level for a pair', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await fundSwap.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [
        {
          fee: 100,
          minAmount: 0,
        },
      ],
    );

    await expect(
      fundSwap
        .connect(user2)
        .setFeeLevelsForPair(erc20Token.getAddress(), wmaticToken.getAddress(), [
          {
            fee: 50,
            minAmount: ethers.parseEther('2'),
          },
        ]),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should get the correct fee for a given pair and the amount', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await fundSwap.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [
        {
          fee: 100,
          minAmount: 0,
        },
        {
          fee: 80,
          minAmount: ethers.parseEther('2'),
        },
      ],
    );

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));
    await fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.01'),
    );
    await fundSwap.withdrawFees(erc20Token.getAddress(), ethers.parseEther('0.01'));

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('2'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('2'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('4'));
    await fundSwap.connect(user2).fillPublicOrder(1, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.016'), // 0.8% of 2
    );
  });

  it('should allow to remove fee levels for a pair', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await fundSwap.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [
        {
          fee: 100,
          minAmount: 0,
        },
      ],
    );

    await fundSwap.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [],
    );

    expect(await fundSwap.getFeeLevelsForAllPairs()).to.be.deep.equal([]);
  });

  it('should allow to get all fee levels for a pair', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await fundSwap.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [
        {
          fee: 100,
          minAmount: 0,
        },
        {
          fee: 50,
          minAmount: ethers.parseEther('2'),
        },
        {
          fee: 25,
          minAmount: ethers.parseEther('3'),
        },
      ],
    );

    const feeLevels = await fundSwap.getFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
    );

    expect(feeLevels[0].fee).to.equal(100);
    expect(feeLevels[0].minAmount).to.equal(0);
    expect(feeLevels[1].fee).to.equal(50);
    expect(feeLevels[1].minAmount).to.equal(ethers.parseEther('2'));
    expect(feeLevels[2].fee).to.equal(25);
    expect(feeLevels[2].minAmount).to.equal(ethers.parseEther('3'));
  });

  it('should allow to get all fee levels for all pairs', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await fundSwap.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [
        {
          fee: 100,
          minAmount: 0,
        },
        {
          fee: 50,
          minAmount: ethers.parseEther('2'),
        },
        {
          fee: 25,
          minAmount: ethers.parseEther('3'),
        },
      ],
    );

    await fundSwap.setFeeLevelsForPair(
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      [
        {
          fee: 200,
          minAmount: 0,
        },
        {
          fee: 100,
          minAmount: ethers.parseEther('2'),
        },
        {
          fee: 50,
          minAmount: ethers.parseEther('3'),
        },
      ],
    );

    const pairFees = await fundSwap.getFeeLevelsForAllPairs();
    if (await wmaticToken.getAddress() < await erc20Token.getAddress()) {
      expect(pairFees[0].asset1).to.equal(await wmaticToken.getAddress());
      expect(pairFees[0].asset2).to.equal(await erc20Token.getAddress());
    } else {
      expect(pairFees[0].asset1).to.equal(await erc20Token.getAddress());
      expect(pairFees[0].asset2).to.equal(await wmaticToken.getAddress());
    }

    expect(pairFees[0].feeLevels[0].fee).to.equal(100);
    expect(pairFees[0].feeLevels[0].minAmount).to.equal(0);
    expect(pairFees[0].feeLevels[1].fee).to.equal(50);
    expect(pairFees[0].feeLevels[1].minAmount).to.equal(ethers.parseEther('2'));
    expect(pairFees[0].feeLevels[2].fee).to.equal(25);
    expect(pairFees[0].feeLevels[2].minAmount).to.equal(ethers.parseEther('3'));

    expect(pairFees[1].asset1).to.equal('0x0000000000000000000000000000000000000001');
    expect(pairFees[1].asset2).to.equal('0x0000000000000000000000000000000000000002');
    expect(pairFees[1].feeLevels[0].fee).to.equal(200);
    expect(pairFees[1].feeLevels[0].minAmount).to.equal(0);
    expect(pairFees[1].feeLevels[1].fee).to.equal(100);
    expect(pairFees[1].feeLevels[1].minAmount).to.equal(ethers.parseEther('2'));
    expect(pairFees[1].feeLevels[2].fee).to.equal(50);
    expect(pairFees[1].feeLevels[2].minAmount).to.equal(ethers.parseEther('3'));
  });

  it('should have the same fee no matter which token is offered in a pair', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await fundSwap.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [
        {
          fee: 100,
          minAmount: 0,
        },
      ],
    );

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('2'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('2'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('4'));
    await fundSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.02'), // 1% of 2
    );

    await wmaticToken.approve(fundSwap.getAddress(), ethers.parseEther('2'));
    await fundSwap.createPublicOrder({
      offeredToken: wmaticToken.getAddress(),
      amountOffered: ethers.parseEther('2'),
      wantedToken: erc20Token.getAddress(),
      amountWanted: ethers.parseEther('4'),
      deadline: 0,
    });

    await erc20Token
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('4'));
    await fundSwap.connect(user2).fillPublicOrder(1, user2.getAddress());

    expect(await wmaticToken.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.02'), // 1% of 2
    );
  });
});
