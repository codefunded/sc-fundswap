// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '../OrderStructs.sol';
import '../IFundSwap.sol';
import '../FundSwap.sol';
import { OrderSignatureVerifierLib } from '../libraries/OrderSignatureVerifierLib.sol';

/**
 * @notice An extenstion contract that allows to create private orders which can have a specific recipient
 * and a deadline. These orders are not saved onchain but can be passed from the maker to the filler offchain.
 *
 */
contract FundSwapPrivateOrderExecutor is
  IFundSwapEvents,
  IFundSwapErrors,
  Context,
  ReentrancyGuard,
  ERC721Holder
{
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  FundSwap public fundswap;

  /// @dev token => order hash => is executed
  mapping(address => mapping(bytes32 => bool)) public executedPrivateOrderHashes;

  constructor(FundSwap _fundswap) {
    fundswap = _fundswap;
  }

  /**
   * @notice Computes a hash of private order data. This hash can be used by the recipient to finalize the order.
   * Only whitelisted tokens can be used.
   * @param order Private order data
   * @return orderHash Hash of the order
   */
  function createPrivateOrder(
    PrivateOrder memory order
  ) external view returns (bytes32 orderHash) {
    return OrderSignatureVerifierLib.hashOrder(order);
  }

  /**
   * @notice Verifies if the signature matches private order data and a hash of the order data.
   * @param order Private order data
   * @param orderHash Hash of the order
   * @param signature Signature of the order
   */
  function verifyOrder(
    PrivateOrder memory order,
    bytes32 orderHash,
    bytes memory signature
  ) external view returns (bool) {
    return OrderSignatureVerifierLib.verifyOrder(order, orderHash, signature);
  }

  /**
   * @notice Invalidates a private order. Since private orders are not stored on-chain, there is no way to cancel them.
   * This function allows the maker to invalidate the order and prevent the recipient from finalizing it. It can be
   * useful if a user shares the order and a signature with the filler but then changes their mind.
   * @param order Private order data
   */
  function invalidatePrivateOrder(PrivateOrder memory order) external {
    if (_msgSender() != order.maker) revert FundSwap__NotAnOwner();
    bytes32 orderHash = OrderSignatureVerifierLib.hashOrder(order);

    executedPrivateOrderHashes[order.maker][orderHash] = true;

    emit PrivateOrderInvalidated(
      order.makerSellToken,
      order.makerSellTokenAmount,
      order.makerBuyToken,
      order.makerBuyTokenAmount,
      order.maker,
      order.recipient,
      order.deadline,
      order.creationTimestamp,
      orderHash
    );
  }

  /**
   * @notice Fills a private order with permit so the private order can be filled in a single transaction.
   * Only whitelisted tokens can be used.
   * @param order private order data
   * @param orderHash hash of the order
   * @param sig maker signature of the order
   * @param deadline deadline for permit
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   */
  function fillPrivateOrderWithPermit(
    PrivateOrder calldata order,
    bytes32 orderHash,
    bytes memory sig,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    IERC20Permit(order.makerBuyToken).permit(
      _msgSender(),
      address(this),
      order.makerBuyTokenAmount,
      deadline,
      v,
      r,
      s
    );
    fillPrivateOrder(order, orderHash, sig);
  }

  /**
   * @notice Fills a private order. Only whitelisted tokens can be used. Under the hood it creates a public
   * order from the private order and immedietly fills it in the same transaction in order for plugins to
   * correctly execute.
   * @param privateOrder private order data
   * @param orderHash hash of the order
   * @param sig maker's signature of the order
   */
  function fillPrivateOrder(
    PrivateOrder memory privateOrder,
    bytes32 orderHash,
    bytes memory sig
  ) public nonReentrant returns (SwapResult memory result) {
    if (!OrderSignatureVerifierLib.verifyOrder(privateOrder, orderHash, sig)) {
      revert FundSwap__InvalidOrderSignature();
    }
    if (privateOrder.makerSellTokenAmount == 0) {
      revert FundSwap__MakerSellTokenAmountIsZero();
    }
    if (privateOrder.makerBuyTokenAmount == 0) {
      revert FundSwap__MakerBuyTokenAmountIsZero();
    }
    if (privateOrder.makerBuyToken == privateOrder.makerSellToken) {
      revert FundSwap__InvalidPath();
    }
    if (
      IERC20(privateOrder.makerSellToken).balanceOf(privateOrder.maker) <
      privateOrder.makerSellTokenAmount
    ) {
      revert FundSwap__InsufficientMakerBalance();
    }
    if (privateOrder.deadline != 0 && block.timestamp > privateOrder.deadline) {
      revert FundSwap__OrderExpired();
    }
    if (privateOrder.recipient != address(0) && privateOrder.recipient != _msgSender()) {
      revert FundSwap__YouAreNotARecipient();
    }
    if (
      executedPrivateOrderHashes[privateOrder.maker][
        OrderSignatureVerifierLib.hashOrder(privateOrder)
      ]
    ) {
      revert FundSwap__OrderHaveAlreadyBeenExecuted();
    }

    executedPrivateOrderHashes[privateOrder.maker][
      OrderSignatureVerifierLib.hashOrder(privateOrder)
    ] = true;

    // create public order on the fly from private order, this is needed so all the plugins are executed
    PublicOrder memory order = PublicOrder({
      makerSellToken: privateOrder.makerSellToken,
      makerBuyToken: privateOrder.makerBuyToken,
      makerSellTokenAmount: privateOrder.makerSellTokenAmount,
      makerBuyTokenAmount: privateOrder.makerBuyTokenAmount,
      deadline: privateOrder.deadline
    });

    // collect tokens needed for creating the order
    IERC20(privateOrder.makerSellToken).safeTransferFrom(
      // maker has to sign the order first so it is not vulnerable to arbitrary erc20 transfer
      // https://github.com/crytic/slither/wiki/Detector-Documentation#arbitrary-from-in-transferfrom
      privateOrder.maker,
      address(this),
      privateOrder.makerSellTokenAmount
    );
    IERC20(privateOrder.makerSellToken).approve(
      address(fundswap),
      privateOrder.makerSellTokenAmount
    );
    IERC20(privateOrder.makerBuyToken).safeTransferFrom(
      _msgSender(),
      address(this),
      privateOrder.makerBuyTokenAmount
    );
    IERC20(privateOrder.makerBuyToken).approve(
      address(fundswap),
      privateOrder.makerBuyTokenAmount
    );

    // make order on behalf of the maker
    uint256 orderId = fundswap.createPublicOrder(order);

    result = fundswap.fillPublicOrder(orderId, _msgSender());

    // send tokens received from an order fill to the initial maker
    IERC20(privateOrder.makerBuyToken).safeTransfer(
      privateOrder.maker,
      privateOrder.makerBuyTokenAmount
    );

    emit PrivateOrderFilled(
      privateOrder.makerSellToken,
      privateOrder.makerBuyToken,
      privateOrder.maker,
      privateOrder.recipient
    );
  }
}
