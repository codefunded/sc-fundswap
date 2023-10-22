// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import './FundSwapOrderManager.sol';
import './OrderStructs.sol';

interface IFundSwapErrors {
  error FundSwap__InvalidOrderSignature();
  error FundSwap__InsufficientMakerBalance();
  error FundSwap__YouAreNotARecipient();
  error FundSwap__NotAnOwner();
  error FundSwap__OrderDoesNotExist();
  error FundSwap__OrderExpired();
  error FundSwap__OrderHaveAlreadyBeenExecuted();
  error FundSwap__MakerSellTokenAmountIsZero();
  error FundSwap__MakerBuyTokenAmountIsZero();
  error FundSwap__InsufficientAmountOut();
  error FundSwap__AmountInExceededLimit();
  error FundSwap__InvalidPath();
  error FundSwap__IncorrectOrderType();
  error FundSwap__WithdrawalViolatesFullBackingRequirement();
}

interface IFundSwapEvents {
  event PublicOrderCreated(
    uint256 indexed tokenId,
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address owner,
    uint256 deadline
  );
  event PublicOrderFilled(
    uint256 indexed tokenId,
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address owner,
    address taker
  );
  event PublicOrderPartiallyFilled(uint256 indexed tokenId, address indexed taker);
  event PublicOrderCancelled(
    uint256 indexed tokenId,
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address owner
  );
  event PrivateOrderInvalidated(
    address indexed makerSellToken,
    uint256 makerSellTokenAmount,
    address indexed makerBuyToken,
    uint256 makerBuyTokenAmount,
    address indexed maker,
    address recipient,
    uint256 deadline,
    uint256 creationTimestamp,
    bytes32 orderHash
  );
  event PrivateOrderFilled(
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address maker,
    address taker
  );
  event PluginEnabled(address indexed plugin);
  event PluginDisabled(address indexed plugin);
}
