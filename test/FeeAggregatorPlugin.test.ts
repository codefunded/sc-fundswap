import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { expect } from 'chai';
import { DEFAULT_FEE } from '../utils/constants';

describe('FeeAggregatorPlugin', () => {
  it('should allow to get current fee value in basis points', async () => {
    const { feeAggregatorPlugin } = await loadFixture(prepareTestEnv);

    const currentFee = await feeAggregatorPlugin.defaultFee();
    expect(currentFee).to.equal(DEFAULT_FEE);
    const maxFee = await feeAggregatorPlugin.MAX_FEE();
    expect(maxFee).to.equal(300); // 3%
    const basisPointsMax = await feeAggregatorPlugin.BASIS_POINTS_MAX();
    expect(basisPointsMax).to.equal(10000); // 100%
  });

  it('should assign the owner', async () => {
    const { fundSwap } = await loadFixture(prepareTestEnv);
    const [owner] = await ethers.getSigners();

    const isOwner = await fundSwap.hasRole(
      await fundSwap.DEFAULT_ADMIN_ROLE(),
      await owner.getAddress(),
    );
    expect(isOwner).to.equal(true);
  });

  it('owner should be allowed to set a new fee value', async () => {
    const { fundSwap, feeAggregatorPlugin } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();
    const isOwner = await fundSwap.hasRole(
      await fundSwap.DEFAULT_ADMIN_ROLE(),
      await user1.getAddress(),
    );
    expect(isOwner).to.equal(true);
    const feeAggregatorPluginOwner = await feeAggregatorPlugin.owner();
    expect(feeAggregatorPluginOwner).to.equal(await user1.getAddress());

    await feeAggregatorPlugin.setDefaultFee(100);
    const currentFee = await feeAggregatorPlugin.defaultFee();
    expect(currentFee).to.equal(100);

    await expect(
      feeAggregatorPlugin.connect(user2).setDefaultFee(100),
    ).to.be.revertedWithCustomError(feeAggregatorPlugin, 'OwnableUnauthorizedAccount');
  });

  it('should accrue fees when public market order is executed', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    const order = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const orderHash = await fundSwap.getPublicOrderHash(order);
    await fundSwap.createPublicOrder(order);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(orderHash, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.0024'),
    );
  });

  it('owner should be allowed to withdraw fees', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    const order = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const orderHash = await fundSwap.getPublicOrderHash(order);
    await fundSwap.createPublicOrder(order);

    const user1BalanceBeforeSwap = await erc20Token.balanceOf(user1.getAddress());

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    expect(await fundSwap.getRequiredTreasuryBalance(erc20Token.getAddress())).to.equal(
      ethers.parseEther('1'),
    );
    await expect(
      fundSwap.withdraw(erc20Token.getAddress(), ethers.parseEther('0.0024')),
    ).to.be.revertedWithCustomError(
      fundSwap,
      'FundSwap__WithdrawalViolatesFullBackingRequirement',
    );

    await fundSwap.connect(user2).fillPublicOrder(orderHash, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.0024'),
    );

    expect(await fundSwap.getRequiredTreasuryBalance(erc20Token.getAddress())).to.equal(
      0n,
    );

    await fundSwap.withdraw(erc20Token.getAddress(), ethers.parseEther('0.0024'));

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0'),
    );
    expect(await erc20Token.balanceOf(user1.getAddress())).to.equal(
      ethers.parseEther('0.0024') + user1BalanceBeforeSwap,
    );
  });

  it('should not allow FundSwap admin to withdraw tokens that were deposited by makers when creating orders', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    const order = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
      creationTimestamp: 0,
    };
    await fundSwap.createPublicOrder(order);

    expect(
      fundSwap.withdraw(erc20Token.getAddress(), ethers.parseEther('1')),
    ).to.be.revertedWithCustomError(
      fundSwap,
      'FundSwap__WithdrawalViolatesFullBackingRequirement',
    );
  });

  it('should allow owner to set a fee for a specific token', async () => {
    const { fundSwap, feeAggregatorPlugin, erc20Token, wmaticToken, usdcToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    const order = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const orderHash = await fundSwap.getPublicOrderHash(order);
    await fundSwap.createPublicOrder(order);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await feeAggregatorPlugin.setFeeForAsset(erc20Token.getAddress(), 100);

    await fundSwap.connect(user2).fillPublicOrder(orderHash, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.01'),
    );

    await usdcToken.approve(fundSwap.getAddress(), ethers.parseUnits('1', 6));
    const order2 = {
      makerSellToken: usdcToken.getAddress(),
      makerSellTokenAmount: ethers.parseUnits('1', 6),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const order2Hash = await fundSwap.getPublicOrderHash(order2);
    await fundSwap.createPublicOrder(order2);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(order2Hash, user2.getAddress());

    // default fee is 0.24%, if not set for a specific token
    expect(await usdcToken.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseUnits('0.0024', 6),
    );
  });

  it('should allow to get all fees set for all tokens', async () => {
    const { feeAggregatorPlugin, erc20Token, usdcToken } =
      await loadFixture(prepareTestEnv);

    await feeAggregatorPlugin.setFeeForAsset(erc20Token.getAddress(), 100);
    await feeAggregatorPlugin.setFeeForAsset(usdcToken.getAddress(), 200);

    const fees = await Promise.all([
      feeAggregatorPlugin.getFeeForAsset(erc20Token.getAddress()),
      feeAggregatorPlugin.getFeeForAsset(usdcToken.getAddress()),
    ]);

    expect(fees[0]).to.equal(100);
    expect(fees[1]).to.equal(200);
  });

  it('should allow to disable swap fee by setting the fee to 0', async () => {
    const { fundSwap, feeAggregatorPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await feeAggregatorPlugin.setFeeForAsset(erc20Token.getAddress(), 0);

    const fee = await feeAggregatorPlugin.getFeeForAsset(erc20Token.getAddress());
    expect(fee).to.equal(0);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('1'));
    const order = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const orderHash = await fundSwap.getPublicOrderHash(order);
    await fundSwap.createPublicOrder(order);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(orderHash, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(0);
  });

  it('should allow to set a fee level for a pair', async () => {
    const { feeAggregatorPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await feeAggregatorPlugin.setFeeLevelsForPair(
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
      feeAggregatorPlugin
        .connect(user2)
        .setFeeLevelsForPair(erc20Token.getAddress(), wmaticToken.getAddress(), [
          {
            fee: 50,
            minAmount: ethers.parseEther('2'),
          },
        ]),
    ).to.be.revertedWithCustomError(feeAggregatorPlugin, 'OwnableUnauthorizedAccount');
  });

  it('should get the correct fee for a given pair and the amount', async () => {
    const { fundSwap, feeAggregatorPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await feeAggregatorPlugin.setFeeLevelsForPair(
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
    const order = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const orderHash = await fundSwap.getPublicOrderHash(order);
    await fundSwap.createPublicOrder(order);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('2'));
    await fundSwap.connect(user2).fillPublicOrder(orderHash, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.01'),
    );
    await fundSwap.withdraw(erc20Token.getAddress(), ethers.parseEther('0.01'));

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('2'));
    const order2 = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('2'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('4'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const orderHash2 = await fundSwap.getPublicOrderHash(order2);
    await fundSwap.createPublicOrder(order2);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('4'));
    await fundSwap.connect(user2).fillPublicOrder(orderHash2, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.016'), // 0.8% of 2
    );
  });

  it('should allow to remove fee levels for a pair', async () => {
    const { feeAggregatorPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);

    await feeAggregatorPlugin.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [
        {
          fee: 100,
          minAmount: 0,
        },
      ],
    );

    await feeAggregatorPlugin.setFeeLevelsForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
      [],
    );

    expect(
      await feeAggregatorPlugin.getFeeLevelsForPair(
        erc20Token.getAddress(),
        wmaticToken.getAddress(),
      ),
    ).to.be.deep.equal([]);
  });

  it('should allow to get all fee levels for a pair', async () => {
    const { feeAggregatorPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);

    await feeAggregatorPlugin.setFeeLevelsForPair(
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

    const feeLevels = await feeAggregatorPlugin.getFeeLevelsForPair(
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
    const { feeAggregatorPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);

    await feeAggregatorPlugin.setFeeLevelsForPair(
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

    await feeAggregatorPlugin.setFeeLevelsForPair(
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

    const pairFees = await Promise.all([
      feeAggregatorPlugin.getFeeLevelsForPair(
        erc20Token.getAddress(),
        wmaticToken.getAddress(),
      ),
      feeAggregatorPlugin.getFeeLevelsForPair(
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
      ),
    ]);

    expect(pairFees[0][0].fee).to.equal(100);
    expect(pairFees[0][0].minAmount).to.equal(0);
    expect(pairFees[0][1].fee).to.equal(50);
    expect(pairFees[0][1].minAmount).to.equal(ethers.parseEther('2'));
    expect(pairFees[0][2].fee).to.equal(25);
    expect(pairFees[0][2].minAmount).to.equal(ethers.parseEther('3'));

    expect(pairFees[1][0].fee).to.equal(200);
    expect(pairFees[1][0].minAmount).to.equal(0);
    expect(pairFees[1][1].fee).to.equal(100);
    expect(pairFees[1][1].minAmount).to.equal(ethers.parseEther('2'));
    expect(pairFees[1][2].fee).to.equal(50);
    expect(pairFees[1][2].minAmount).to.equal(ethers.parseEther('3'));
  });

  it('should have the same fee no matter which token is a base token in a pair', async () => {
    const { fundSwap, feeAggregatorPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await feeAggregatorPlugin.setFeeLevelsForPair(
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
    const order = {
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('2'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('4'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const orderHash = await fundSwap.getPublicOrderHash(order);
    await fundSwap.createPublicOrder(order);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('4'));
    await fundSwap.connect(user2).fillPublicOrder(orderHash, user2.getAddress());

    expect(await erc20Token.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.02'), // 1% of 2
    );

    await wmaticToken.approve(fundSwap.getAddress(), ethers.parseEther('2'));
    const order2 = {
      makerSellToken: wmaticToken.getAddress(),
      makerSellTokenAmount: ethers.parseEther('2'),
      makerBuyToken: erc20Token.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('4'),
      deadline: 0,
      creationTimestamp: 0,
    };
    const order2Hash = await fundSwap.getPublicOrderHash(order2);
    await fundSwap.createPublicOrder(order2);

    await erc20Token
      .connect(user2)
      .approve(fundSwap.getAddress(), ethers.parseEther('4'));
    await fundSwap.connect(user2).fillPublicOrder(order2Hash, user2.getAddress());

    expect(await wmaticToken.balanceOf(fundSwap.getAddress())).to.equal(
      ethers.parseEther('0.02'), // 1% of 2
    );
  });
});
