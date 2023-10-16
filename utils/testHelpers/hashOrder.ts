import { ethers } from 'ethers';
import { PrivateOrderStruct } from '../../typechain-types/contracts/FundSwap';

export function hashOrder(
  order: PrivateOrderStruct,
  chainId = 31337 /* chainId of hardhat */,
): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      [
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
        chainId,
        order.creator,
        order.deadline,
        order.offeredToken,
        order.amountOffered,
        order.wantedToken,
        order.amountWanted,
        order.recipient,
        order.creationTimestamp,
      ],
    ),
  );
}
