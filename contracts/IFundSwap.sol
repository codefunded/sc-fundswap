// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import './FundSwapOrderManager.sol';
import './OrderStructs.sol';

interface IFundSwapErrors {
  error FundSwap__InvalidOrderSignature();
  error FundSwap__InsufficientCreatorBalance();
  error FundSwap__YouAreNotARecipient();
  error FundSwap__NotAnOwner();
  error FundSwap__OrderDoesNotExist();
  error FundSwap__OrderExpired();
  error FundSwap__OrderHaveAlreadyBeenExecuted();
  error FundSwap__OfferedAmountIsZero();
  error FundSwap__WantedAmountIsZero();
  error FundSwap__InsufficientAmountOut();
  error FundSwap__AmountInExceededLimit();
  error FundSwap__InvalidPath();
  error FundSwap__IncorrectOrderType();
}

interface IFundSwapEvents {
  event PublicOrderCreated(
    uint256 indexed tokenId,
    address indexed offeredToken,
    address indexed wantedToken,
    address owner,
    uint256 deadline
  );
  event PublicOrderFilled(
    uint256 indexed tokenId,
    address indexed offeredToken,
    address indexed wantedToken,
    address owner,
    address taker
  );
  event PublicOrderPartiallyFilled(uint256 indexed tokenId, address indexed taker);
  event PublicOrderCancelled(
    uint256 indexed tokenId,
    address indexed offeredToken,
    address indexed wantedToken,
    address owner
  );
  event PrivateOrderInvalidated(
    address indexed offeredToken,
    uint256 amountOffered,
    address indexed wantedToken,
    uint256 amountWanted,
    address indexed creator,
    address recipient,
    uint256 deadline,
    uint256 creationTimestamp,
    bytes32 orderHash
  );
  event PrivateOrderFilled(
    address indexed offeredToken,
    address indexed wantedToken,
    address creator,
    address taker
  );
}
