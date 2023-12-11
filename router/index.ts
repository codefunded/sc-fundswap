import { AddressLike, BigNumberish, BytesLike } from 'ethers';
import {
  OrderFillRequestStruct,
  PublicOrderStruct,
} from '../typechain-types/contracts/FundSwap';

export type PublicOrder = {
  [key in keyof PublicOrderStruct]: Awaited<PublicOrderStruct[key]> extends BigNumberish
    ? bigint
    : Awaited<AddressLike>;
} & { id: BytesLike };

export type FillRequest = {
  sourceToken: string;
  destinationToken: string;
} & (
  | {
      type: 'EXACT_INPUT';
      sourceAmount: bigint;
    }
  | {
      type: 'EXACT_OUTPUT';
      destinationAmount: bigint;
    }
);

const calculatePrice = (order: Omit<PublicOrder, 'id'>) => {
  const price =
    ((order.makerBuyTokenAmount as bigint) * BigInt(1e18)) /
    (order.makerSellTokenAmount as bigint);
  return price;
};

export const sortOrdersByPrice = (
  order1: Omit<PublicOrder, 'id'>,
  order2: Omit<PublicOrder, 'id'>,
) => {
  const price1 = calculatePrice(order1);
  const price2 = calculatePrice(order2);
  return price1 < price2 ? -1 : 1;
};

type BigNumberify<T> = {
  [key in keyof T]: T[key] extends BigNumberish ? bigint : T[key];
};

interface Path {
  route: BigNumberify<OrderFillRequestStruct>[];
  amountRemainingToFill: bigint;
  inputAmount: bigint;
  outputAmount: bigint;
}

const createFillRequest = (
  orderHash: BytesLike,
  amountIn: bigint,
): BigNumberify<OrderFillRequestStruct> => ({
  orderHash: orderHash,
  amountIn,
  minAmountOut: 0n, // TODO: add actual value of minAmountOut
});

/**
 * Simple routing algorithm that returns the best trade route for a given fill request. It only supports
 * requests that have a single hop (i.e. sourceToken -> destinationToken, no intermediate tokens).
 * @param fillRequest The fill request to route
 * @param orders The orders to route through
 * @returns The best trade route for the given fill request or an empty array if no route exists. The route
 * is an array of order IDs.
 */
export const createTradeRoute = (
  fillRequest: FillRequest,
  orders: readonly PublicOrder[],
  currentTimestamp = BigInt(Date.now()) / 1000n,
) => {
  const { sourceToken, destinationToken } = fillRequest;
  const ordersForPair = [...orders]
    .filter(
      (order) =>
        order.makerSellToken === destinationToken && order.makerBuyToken === sourceToken,
    )
    .filter((order) => (order.deadline === 0n ? true : order.deadline > currentTimestamp))
    .sort(sortOrdersByPrice);
  if (ordersForPair.length === 0) {
    throw new NotEnoughLiquidity();
  }

  if (fillRequest.type === 'EXACT_INPUT') {
    const { sourceAmount } = fillRequest;

    const path = ordersForPair.reduce<Path>(
      (acc, order) => {
        if (acc.amountRemainingToFill === 0n || acc.amountRemainingToFill < 0n) {
          return acc;
        }

        if (acc.amountRemainingToFill < order.makerBuyTokenAmount) {
          const partialOrder = createFillRequest(order.id, acc.amountRemainingToFill);
          return {
            route: [...acc.route, partialOrder],
            amountRemainingToFill: 0n,
            inputAmount: acc.inputAmount,
            outputAmount:
              acc.outputAmount +
              (acc.amountRemainingToFill * order.makerSellTokenAmount) /
                order.makerBuyTokenAmount,
          };
        }

        return {
          route: [...acc.route, createFillRequest(order.id, order.makerBuyTokenAmount)],
          amountRemainingToFill: acc.amountRemainingToFill - order.makerBuyTokenAmount,
          inputAmount: acc.inputAmount,
          outputAmount: acc.outputAmount + order.makerSellTokenAmount,
        };
      },
      {
        route: [],
        amountRemainingToFill: sourceAmount,
        inputAmount: sourceAmount,
        outputAmount: 0n,
      },
    );

    if (path.amountRemainingToFill > 0) {
      throw new NotEnoughLiquidity();
    }

    return {
      route: path.route,
      inputAmount: path.inputAmount,
      outputAmount: path.outputAmount,
    };
  } else {
    const { destinationAmount } = fillRequest;

    const path = ordersForPair.reduce<Path>(
      (acc, order) => {
        if (acc.amountRemainingToFill === 0n) {
          return acc;
        }

        if (order.makerSellTokenAmount > acc.amountRemainingToFill) {
          const partialOrder = createFillRequest(order.id, acc.amountRemainingToFill);
          const percentageOfFill =
            (Number(acc.amountRemainingToFill) / Number(order.makerSellTokenAmount)) *
            1e18;
          return {
            route: [...acc.route, partialOrder],
            amountRemainingToFill: 0n,
            inputAmount:
              acc.inputAmount +
              (order.makerBuyTokenAmount * BigInt(percentageOfFill)) / BigInt(1e18),
            outputAmount: acc.outputAmount,
          };
        }

        return {
          route: [...acc.route, createFillRequest(order.id, order.makerBuyTokenAmount)],
          amountRemainingToFill: acc.amountRemainingToFill - order.makerSellTokenAmount,
          inputAmount: acc.inputAmount + order.makerBuyTokenAmount,
          outputAmount: acc.outputAmount,
        };
      },
      {
        route: [],
        amountRemainingToFill: destinationAmount,
        inputAmount: 0n,
        outputAmount: destinationAmount,
      },
    );

    if (path.amountRemainingToFill > 0) {
      throw new NotEnoughLiquidity();
    }

    return {
      route: path.route,
      inputAmount: path.inputAmount,
      outputAmount: path.outputAmount,
    };
  }
};

class NotEnoughLiquidity extends Error {
  constructor() {
    super('Not enough liquidity to fill the request');
  }
}
