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
}

const mapOrderToExactInputFillRequest = (
  order: PublicOrder,
): BigNumberify<OrderFillRequestStruct> => ({
  orderHash: order.id,
  amountIn: order.makerSellTokenAmount,
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
) => {
  if (fillRequest.type === 'EXACT_INPUT') {
    const { sourceToken, destinationToken, sourceAmount } = fillRequest;
    const ordersForPair = [...orders]
      .filter(
        (order) =>
          order.makerSellToken === destinationToken &&
          order.makerBuyToken === sourceToken,
      )
      .sort(sortOrdersByPrice);
    if (ordersForPair.length === 0) {
      return [];
    }

    const path = ordersForPair.reduce<Path>(
      (acc, order) => {
        if (acc.amountRemainingToFill === 0n) {
          return acc;
        }

        if (acc.amountRemainingToFill < order.makerBuyTokenAmount) {
          const partialOrder = mapOrderToExactInputFillRequest(order);
          partialOrder.amountIn = acc.amountRemainingToFill;
          return {
            route: [...acc.route, partialOrder],
            amountRemainingToFill: 0n,
          };
        }

        return {
          route: [...acc.route, mapOrderToExactInputFillRequest(order)],
          amountRemainingToFill: acc.amountRemainingToFill - order.makerBuyTokenAmount,
        };
      },
      {
        route: [],
        amountRemainingToFill: sourceAmount,
      },
    );

    if (path.amountRemainingToFill > 0) {
      throw new Error('Not enough liquidity to fill the request');
    }

    return path.route;
  } else {
    const { sourceToken, destinationToken, destinationAmount } = fillRequest;

    const ordersForPair = [...orders]
      .filter(
        (order) =>
          order.makerSellToken === destinationToken &&
          order.makerBuyToken === sourceToken,
      )
      .sort(sortOrdersByPrice);
    if (ordersForPair.length === 0) {
      return [];
    }

    const path = ordersForPair.reduce<Path>(
      (acc, order) => {
        if (acc.amountRemainingToFill === 0n) {
          return acc;
        }

        if (acc.amountRemainingToFill < order.makerSellTokenAmount) {
          const partialOrder = mapOrderToExactInputFillRequest(order);
          partialOrder.amountIn = acc.amountRemainingToFill;
          return {
            route: [...acc.route, partialOrder],
            amountRemainingToFill: 0n,
          };
        }

        return {
          route: [...acc.route, mapOrderToExactInputFillRequest(order)],
          amountRemainingToFill: acc.amountRemainingToFill - order.makerSellTokenAmount,
        };
      },
      {
        route: [],
        amountRemainingToFill: destinationAmount,
      },
    );

    if (path.amountRemainingToFill > 0) {
      throw new Error('Not enough liquidity to fill the request');
    }

    return path.route;
  }
};
