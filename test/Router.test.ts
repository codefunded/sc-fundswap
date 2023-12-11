import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { PublicOrder, createTradeRoute, sortOrdersByPrice } from '../router';
import { expect } from 'chai';

const hashPublicOrder = (
  order: Omit<PublicOrder, 'id'>,
  chainId = 31337 /* chainId of hardhat */,
) =>
  ethers.keccak256(
    ethers.solidityPacked(
      ['uint256', 'uint256', 'address', 'uint256', 'address', 'uint256', 'uint256'],
      [
        chainId,
        order.deadline,
        order.makerSellToken,
        order.makerSellTokenAmount,
        order.makerBuyToken,
        order.makerBuyTokenAmount,
        order.creationTimestamp,
      ],
    ),
  );

describe('Router', () => {
  describe('sortByPrice helper', () => {
    it('Should sort orders by price from the lowest to highest', () => {
      const order1 = {
        makerSellToken: '1',
        makerBuyToken: '2',
        makerSellTokenAmount: ethers.parseEther('3'),
        makerBuyTokenAmount: ethers.parseEther('15'),
        deadline: 0n,
        creationTimestamp: 0n,
      };
      const order2 = {
        makerSellToken: '1',
        makerBuyToken: '2',
        makerSellTokenAmount: ethers.parseEther('2'),
        makerBuyTokenAmount: ethers.parseEther('2'),
        deadline: 0n,
        creationTimestamp: 0n,
      };

      const orders = [order1, order2];
      const sortedByPrice = [...orders].sort(sortOrdersByPrice);
      expect(sortedByPrice[0]).to.be.equal(orders[1]);
      expect(sortedByPrice[1]).to.be.equal(orders[0]);
    });
  });

  it('router should throw an error when there are no orders for given pair', async () => {
    const { erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    const sourceToken = await wmaticToken.getAddress();
    const destinationToken = await erc20Token.getAddress();

    expect(() =>
      createTradeRoute(
        {
          type: 'EXACT_INPUT',
          sourceToken,
          destinationToken,
          sourceAmount: ethers.parseEther('2'),
        },
        [],
      ),
    ).to.throw('Not enough liquidity to fill the request');
  });

  it('router should route through the best path when exact input is specified', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('3'));
    const [erc20TokenAddress, wmaticTokenAddress] = await Promise.all([
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
    ]);
    const orders = [
      {
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('4'),
        deadline: 0n,
        creationTimestamp: 0n,
      },
      {
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('5'),
        deadline: 0n,
        creationTimestamp: 0n,
      },
      {
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('2'),
        deadline: 0n,
        creationTimestamp: 0n,
      },
    ];
    await fundSwap.createPublicOrder(orders[0]);
    await fundSwap.createPublicOrder(orders[1]);
    await fundSwap.createPublicOrder(orders[2]);

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        sourceAmount: ethers.parseEther('2'),
      },
      orders.map((order) => ({ ...order, id: hashPublicOrder(order) })),
    );
    expect(pathSingle.route.map((step) => step.orderHash)).to.be.deep.equal([
      hashPublicOrder(orders[2]),
    ]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        sourceAmount: ethers.parseEther('6'),
      },
      orders.map((order) => ({ ...order, id: hashPublicOrder(order) })),
    );
    expect(pathTwo.route.map((step) => step.orderHash)).to.be.deep.equal([
      hashPublicOrder(orders[2]),
      hashPublicOrder(orders[0]),
    ]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        sourceAmount: ethers.parseEther('7'),
      },
      orders.map((order) => ({ ...order, id: hashPublicOrder(order) })),
    );

    expect(pathTriple.route.map((step) => step.orderHash)).to.be.deep.equal([
      hashPublicOrder(orders[2]),
      hashPublicOrder(orders[0]),
      hashPublicOrder(orders[1]),
    ]);
  });

  it('getBestTradePathForExactOutput router function should route through the best path', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(fundSwap.getAddress(), ethers.parseEther('3'));
    const [erc20TokenAddress, wmaticTokenAddress] = await Promise.all([
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
    ]);
    const orders = [
      {
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('4'),
        deadline: 0n,
        creationTimestamp: 0n,
      },
      {
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('5'),
        deadline: 0n,
        creationTimestamp: 0n,
      },
      {
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('2'),
        deadline: 0n,
        creationTimestamp: 0n,
      },
    ];
    await fundSwap.createPublicOrder(orders[0]);
    await fundSwap.createPublicOrder(orders[1]);
    await fundSwap.createPublicOrder(orders[2]);

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        destinationAmount: ethers.parseEther('1'),
      },
      orders.map((order) => ({ ...order, id: hashPublicOrder(order) })),
    );
    expect(pathSingle.route.map((step) => step.orderHash)).to.be.deep.equal([
      hashPublicOrder(orders[2]),
    ]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        destinationAmount: ethers.parseEther('2'),
      },
      orders.map((order) => ({ ...order, id: hashPublicOrder(order) })),
    );
    expect(pathTwo.route.map((step) => step.orderHash)).to.be.deep.equal([
      hashPublicOrder(orders[2]),
      hashPublicOrder(orders[0]),
    ]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        destinationAmount: ethers.parseEther('3'),
      },
      orders.map((order) => ({ ...order, id: hashPublicOrder(order) })),
    );
    expect(pathTriple.route.map((step) => step.orderHash)).to.be.deep.equal([
      hashPublicOrder(orders[2]),
      hashPublicOrder(orders[0]),
      hashPublicOrder(orders[1]),
    ]);
  });
});
