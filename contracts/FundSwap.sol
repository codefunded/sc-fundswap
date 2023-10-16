// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import './IFundSwap.sol';
import './OrderStructs.sol';
import { FundSwapOrderManager } from './FundSwapOrderManager.sol';
import { FeeAggregator } from './extensions/FeeAggregator.sol';
import { PairLib } from './libraries/PairLib.sol';
import { OrderLib } from './libraries/OrderLib.sol';
import { OrderSignatureVerifier } from './extensions/OrderSignatureVerifier.sol';
import { TokenWhitelist, TokenWhitelist__TokenNotWhitelisted } from './extensions/TokenWhitelist.sol';

/**
 * @notice FundSwap is a decentralized spot OTC exchange for ERC-20 tokens compatible with EVM chains.
 * It allows to create public and private orders for any ERC-20 token pair. Public orders are available
 * for anyone to fill, while private orders can have a specific recipient and a deadline. Private orders
 * are not saved onchain but can be passed from the creator to the filler offchain. Public orders
 * are represented as ERC-721 tokens. The exchange also supports routing through a chain of orders.
 */
contract FundSwap is
  IFundSwapEvents,
  IFundSwapErrors,
  OrderSignatureVerifier,
  TokenWhitelist,
  FeeAggregator,
  ReentrancyGuard
{
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  /// @dev manager for public orders (ERC721)
  FundSwapOrderManager public immutable orderManager;
  /// @dev token1 => token2 => order IDs
  mapping(address => mapping(address => EnumerableSet.UintSet)) private orderIdsForPair;
  /// @dev token => order hash => is executed
  mapping(address => mapping(bytes32 => bool)) public executedPrivateOrderHashes;

  constructor(uint16 _fee) FeeAggregator(_fee) {
    orderManager = new FundSwapOrderManager();
  }

  // ======== VIEW FUNCTIONS ========

  /**
   * @notice Returns all public orders for a given token pair.
   * @param token1 address of the first token
   * @param token2 address of the second token
   * @return orders array of public orders
   */
  function getOrdersForPair(
    address token1,
    address token2
  ) external view returns (PublicOrderWithId[] memory) {
    (address tokenA, address tokenB) = PairLib.getPairInOrder(token1, token2);
    EnumerableSet.UintSet storage orderIds = orderIdsForPair[tokenA][tokenB];
    if (orderIds.length() == 0) return new PublicOrderWithId[](0);

    PublicOrderWithId[] memory orders = new PublicOrderWithId[](orderIds.length());
    for (uint256 i = 0; i < orderIds.length(); i++) {
      PublicOrder memory order = orderManager.getOrder(orderIds.at(i));
      orders[i] = PublicOrderWithId({
        orderId: orderIds.at(i),
        offeredToken: order.offeredToken,
        wantedToken: order.wantedToken,
        amountOffered: order.amountOffered,
        amountWanted: order.amountWanted,
        deadline: order.deadline
      });
    }
    return orders;
  }

  // ======== PUBLIC ORDERS FUNCTIONS ========

  /**
   * @notice Creates a public order with a permit signature so that the public order can be created
   * in a single transaction.
   * @param order public order data
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return orderId ID of the created order
   */
  function createPublicOrderWithPermit(
    PublicOrder calldata order,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 orderId) {
    IERC20Permit(order.offeredToken).permit(
      _msgSender(),
      address(this),
      order.amountOffered,
      deadline,
      v,
      r,
      s
    );
    return createPublicOrder(order);
  }

  /**
   * @notice Creates a public order. The offered token must be approved for transfer to the exchange. Only
   * whitelisted tokens can be used.
   * @param order public order data
   * @return orderId ID of the created order
   */
  function createPublicOrder(
    PublicOrder calldata order
  )
    public
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (uint256 orderId)
  {
    if (order.amountOffered == 0) revert FundSwap__OfferedAmountIsZero();
    if (order.amountWanted == 0) revert FundSwap__WantedAmountIsZero();
    if (order.wantedToken == order.offeredToken) revert FundSwap__InvalidPath();

    orderId = orderManager.safeMint(_msgSender(), order);

    (address token1, address token2) = PairLib.getPairInOrder(
      order.offeredToken,
      order.wantedToken
    );
    orderIdsForPair[token1][token2].add(orderId);
    emit PublicOrderCreated(
      orderId,
      order.offeredToken,
      order.wantedToken,
      _msgSender(),
      order.deadline
    );

    IERC20(order.offeredToken).safeTransferFrom(
      _msgSender(),
      address(this),
      order.amountOffered
    );
  }

  /**
   * @notice Cancels a public order. Only the order owner can cancel it. The offered token is transferred
   * back to the order owner.
   * @param orderId ID of the order to fill
   */
  function cancelOrder(uint256 orderId) external {
    PublicOrder memory order = orderManager.getOrder(orderId);
    address orderOwner = orderManager.ownerOf(orderId);
    if (orderOwner != _msgSender()) revert FundSwap__NotAnOwner();

    _deleteOrder(orderId, order);

    IERC20(order.offeredToken).safeTransfer(_msgSender(), order.amountOffered);

    emit PublicOrderCancelled(orderId, order.offeredToken, order.wantedToken, orderOwner);
  }

  /**
   * @notice Fills a public order with permit signature so that the public order can be filled in a
   * single transaction. Only whitelisted tokens can be used.
   * @param orderId Order ID to fill
   * @param tokenDestination a recipient of the output token
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return result swap result with data like the amount of output token received and amount of input token spent
   */
  function fillPublicOrderWithPermit(
    uint256 orderId,
    address tokenDestination,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderId);
    IERC20Permit(order.wantedToken).permit(
      _msgSender(),
      address(this),
      order.amountWanted,
      deadline,
      v,
      r,
      s
    );
    return _fillPublicOrder(orderId, order, tokenDestination);
  }

  /**
   * @notice Fills a public order. The wanted token of the order must be approved for transfer to the exchange.
   * Only whitelisted tokens can be used.
   * @param orderId Order ID to fill
   * @param tokenDestination a recipient of the output token
   * @return result swap result with data like the amount of output token received and amount of input token spent
   */
  function fillPublicOrder(
    uint256 orderId,
    address tokenDestination
  ) public returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderId);
    return _fillPublicOrder(orderId, order, tokenDestination);
  }

  function _fillPublicOrder(
    uint256 orderId,
    PublicOrder memory order,
    address tokenDestination
  )
    internal
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (SwapResult memory result)
  {
    if (order.wantedToken == address(0) && order.offeredToken == address(0)) {
      revert FundSwap__OrderDoesNotExist();
    }
    if (order.deadline != 0 && block.timestamp > order.deadline)
      revert FundSwap__OrderExpired();

    address orderOwner = orderManager.ownerOf(orderId);

    // calculates fee amount and marks it as collected
    _accrueFeeForToken(
      order.offeredToken,
      _calculateFeeAmount(order.offeredToken, order.wantedToken, order.amountOffered)
    );

    // Amount out is needed for estimating the amount actually received by the taker
    uint256 outputAmount = _calculateAmountWithDeductedFee(
      order.offeredToken,
      order.wantedToken,
      order.amountOffered
    );

    result = SwapResult({
      outputToken: order.offeredToken,
      outputAmount: outputAmount,
      inputToken: order.wantedToken,
      inputAmount: order.amountWanted
    });

    _deleteOrder(orderId, order);

    // transfer tokens on behalf of the order filler to the order owner
    IERC20(order.wantedToken).safeTransferFrom(
      _msgSender(),
      orderOwner,
      order.amountWanted
    );

    // Transfer tokens to the taker on behalf of the order owner that were
    // deposited to this contract when the order was created.
    IERC20(order.offeredToken).safeTransfer(tokenDestination, outputAmount);

    emit PublicOrderFilled(
      orderId,
      order.offeredToken,
      order.wantedToken,
      orderOwner,
      _msgSender()
    );
  }

  function _deleteOrder(uint256 orderId, PublicOrder memory order) internal {
    (address token1, address token2) = PairLib.getPairInOrder(
      order.offeredToken,
      order.wantedToken
    );
    orderIdsForPair[token1][token2].remove(orderId);
    orderManager.burn(orderId);
  }

  /**
   * @notice Fills a public order partially with permit signature so that the public order can be filled in a
   * single transaction. Only whitelisted tokens can be used.
   * @param orderFillRequest Order fill request data
   * @param tokenDestination a recipient of the output token
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return result swap result with data like the amount of output token received and amount of input token spent
   */
  function fillPublicOrderPartiallyWithPermit(
    OrderFillRequest memory orderFillRequest,
    address tokenDestination,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderFillRequest.orderId);
    uint256 amountToApprove = orderFillRequest.amountIn;
    IERC20Permit(order.wantedToken).permit(
      _msgSender(),
      address(this),
      amountToApprove,
      deadline,
      v,
      r,
      s
    );
    return _fillPublicOrderPartially(orderFillRequest, order, tokenDestination);
  }

  /**
   * @notice Fills a public order partially. The wanted token of the order must be approved for transfer to the exchange.
   * Only whitelisted tokens can be used.
   * @param orderFillRequest Order fill request data
   * @return result swap result with data like the amount of output token received and amount of input token spent
   */
  function fillPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    address tokenDestination
  ) external returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderFillRequest.orderId);
    return _fillPublicOrderPartially(orderFillRequest, order, tokenDestination);
  }

  function _fillPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order,
    address tokenDestination
  )
    internal
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (SwapResult memory result)
  {
    if (order.deadline != 0 && block.timestamp > order.deadline) {
      revert FundSwap__OrderExpired();
    }

    result = SwapResult({
      outputToken: order.offeredToken,
      outputAmount: _fillExactInputPublicOrderPartially(
        orderFillRequest,
        order,
        tokenDestination
      ),
      inputToken: order.wantedToken,
      inputAmount: orderFillRequest.amountIn
    });

    (order.amountWanted, order.amountOffered, , ) = OrderLib
      .calculateOrderAmountsAfterFill(orderFillRequest, order);
    orderManager.updateOrder(orderFillRequest.orderId, order);

    emit PublicOrderPartiallyFilled(orderFillRequest.orderId, _msgSender());

    return result;
  }

  function _fillExactInputPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order,
    address tokenDestination
  ) internal returns (uint256 fillAmountOut) {
    (, , , fillAmountOut) = OrderLib.calculateOrderAmountsAfterFill(
      orderFillRequest,
      order
    );
    _accrueFeeForToken(
      order.offeredToken,
      _calculateFeeAmount(order.offeredToken, order.wantedToken, fillAmountOut)
    );
    fillAmountOut = _calculateAmountWithDeductedFee(
      order.offeredToken,
      order.wantedToken,
      fillAmountOut
    );

    // pay the order owner
    IERC20(order.wantedToken).safeTransferFrom(
      _msgSender(),
      orderManager.ownerOf(orderFillRequest.orderId),
      orderFillRequest.amountIn
    );

    IERC20(order.offeredToken).safeTransfer(tokenDestination, fillAmountOut);
  }

  // ======== PRIVATE ORDERS FUNCTIONS ========

  /**
   * @notice Computes a hash of private order data. This hash can be used by the recipient to finalize the order.
   * Only whitelisted tokens can be used.
   * @param order Private order data
   * @return orderHash Hash of the order
   */
  function createPrivateOrder(
    PrivateOrder memory order
  )
    external
    view
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (bytes32 orderHash)
  {
    return super.hashOrder(order);
  }

  /**
   * @notice Invalidates a private order. Since private orders are not stored on-chain, there is no way to cancel them.
   * This function allows the creator to invalidate the order and prevent the recipient from finalizing it. It can be
   * useful if a user shares the order and a signature with the filler but then changes their mind.
   * @param order Private order data
   */
  function invalidatePrivateOrder(PrivateOrder memory order) external {
    if (_msgSender() != order.creator) revert FundSwap__NotAnOwner();

    executedPrivateOrderHashes[order.creator][hashOrder(order)] = true;

    emit PrivateOrderInvalidated(
      order.offeredToken,
      order.amountOffered,
      order.wantedToken,
      order.amountWanted,
      order.creator,
      order.recipient,
      order.deadline,
      order.creationTimestamp,
      hashOrder(order)
    );
  }

  /**
   * @notice Fills a private order with permit so the private order can be filled in a single transaction.
   * Only whitelisted tokens can be used.
   * @param order private order data
   * @param orderHash hash of the order
   * @param sig creator signature of the order
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
    IERC20Permit(order.wantedToken).permit(
      _msgSender(),
      address(this),
      order.amountWanted,
      deadline,
      v,
      r,
      s
    );
    fillPrivateOrder(order, orderHash, sig);
  }

  /**
   * @notice Fills a private order. Only whitelisted tokens can be used.
   * @param order private order data
   * @param orderHash hash of the order
   * @param sig creator signature of the order
   */
  function fillPrivateOrder(
    PrivateOrder memory order,
    bytes32 orderHash,
    bytes memory sig
  )
    public
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
  {
    if (!super.verifyOrder(order, orderHash, sig)) {
      revert FundSwap__InvalidOrderSignature();
    }
    if (order.amountOffered == 0) {
      revert FundSwap__OfferedAmountIsZero();
    }
    if (order.amountWanted == 0) {
      revert FundSwap__WantedAmountIsZero();
    }
    if (order.wantedToken == order.offeredToken) {
      revert FundSwap__InvalidPath();
    }
    if (IERC20(order.offeredToken).balanceOf(order.creator) < order.amountOffered) {
      revert FundSwap__InsufficientCreatorBalance();
    }
    if (order.deadline != 0 && block.timestamp > order.deadline) {
      revert FundSwap__OrderExpired();
    }
    if (order.recipient != address(0) && order.recipient != _msgSender()) {
      revert FundSwap__YouAreNotARecipient();
    }
    if (executedPrivateOrderHashes[order.creator][hashOrder(order)]) {
      revert FundSwap__OrderHaveAlreadyBeenExecuted();
    }

    executedPrivateOrderHashes[order.creator][hashOrder(order)] = true;
    emit PrivateOrderFilled(
      order.offeredToken,
      order.wantedToken,
      order.creator,
      _msgSender()
    );

    _accrueFeeForToken(
      order.offeredToken,
      _calculateFeeAmount(order.offeredToken, order.wantedToken, order.amountOffered)
    );
    uint256 amountOfferredWithDeductedFee = _calculateAmountWithDeductedFee(
      order.offeredToken,
      order.wantedToken,
      order.amountOffered
    );

    IERC20(order.offeredToken).safeTransferFrom(
      order.creator,
      _msgSender(),
      amountOfferredWithDeductedFee
    );
    IERC20(order.wantedToken).safeTransferFrom(
      _msgSender(),
      order.creator,
      order.amountWanted
    );
  }
}
