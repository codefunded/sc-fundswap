import { ethers } from 'ethers';
import { PrivateOrderStruct } from '../../typechain-types/contracts/periphery/FundSwapPrivateOrderExecutor';

export function hashOrder(
  order: PrivateOrderStruct,
  chainId = 31337 /* chainId of hardhat */,
): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      [
        'string',
        'uint256',
        'address',
        'uint256',
        'address',
        'uint256',
        'address',
        'uint256',
        'address',
        'uint256',
      ],
      [
        'FundSwapV1',
        chainId,
        order.maker,
        order.deadline,
        order.makerSellToken,
        order.makerSellTokenAmount,
        order.makerBuyToken,
        order.makerBuyTokenAmount,
        order.recipient,
        order.creationTimestamp,
      ],
    ),
  );
}
