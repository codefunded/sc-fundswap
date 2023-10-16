import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { createTradeRoute, sortOrdersByPrice } from '../router';
import { expect } from 'chai';

describe('Router', () => {
  describe('sortByPrice helper', () => {
    it('Should sort orders by price from the lowest to highest', () => {
      const orders = [
        {
          orderId: 0,
          offeredToken: '1',
          wantedToken: '2',
          amountOffered: ethers.parseEther('3'),
          amountWanted: ethers.parseEther('15'),
          deadline: 0,
        },
        {
          orderId: 1,
          offeredToken: '1',
          wantedToken: '2',
          amountOffered: ethers.parseEther('2'),
          amountWanted: ethers.parseEther('2'),
          deadline: 0,
        },
      ];
      const sortedByPrice = [...orders].sort(sortOrdersByPrice);
      expect(sortedByPrice[0]).to.be.equal(orders[1]);
      expect(sortedByPrice[1]).to.be.equal(orders[0]);
    });
  });

  it('router should return an empty path when there are no orders for given pair', async () => {
    const { erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    const path = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        sourceAmount: ethers.parseEther('2'),
      },
      [],
    );

    expect(path.map((step) => step.orderId)).to.be.deep.equal([]);
  });

  it('router should route through the best path when exact input is specified', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('3'));
    await fundSwap.createPublicOrder({
      // ID 0
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('4'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 1
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('5'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 2
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    const orders = await fundSwap.getOrdersForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
    );

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        sourceAmount: ethers.parseEther('2'),
      },
      orders,
    );
    expect(pathSingle.map((step) => step.orderId)).to.be.deep.equal([2]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        sourceAmount: ethers.parseEther('6'),
      },
      orders,
    );
    expect(pathTwo.map((step) => step.orderId)).to.be.deep.equal([2, 0]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        sourceAmount: ethers.parseEther('7'),
      },
      orders,
    );

    expect(pathTriple.map((step) => step.orderId)).to.be.deep.equal([2, 0, 1]);
  });

  it('getBestTradePathForExactOutput router function should route through the best path', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('3'));
    await fundSwap.createPublicOrder({
      // ID 0
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('4'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 1
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('5'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 2
      offeredToken: erc20Token.getAddress(),
      amountOffered: ethers.parseEther('1'),
      wantedToken: wmaticToken.getAddress(),
      amountWanted: ethers.parseEther('2'),
      deadline: 0,
    });

    const orders = await fundSwap.getOrdersForPair(
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
    );

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        destinationAmount: ethers.parseEther('1'),
      },
      orders,
    );
    expect(pathSingle.map((step) => step.orderId)).to.be.deep.equal([2]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        destinationAmount: ethers.parseEther('2'),
      },
      orders,
    );
    expect(pathTwo.map((step) => step.orderId)).to.be.deep.equal([2, 0]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        destinationAmount: ethers.parseEther('3'),
      },
      orders,
    );
    expect(pathTriple.map((step) => step.orderId)).to.be.deep.equal([2, 0, 1]);
  });
});
