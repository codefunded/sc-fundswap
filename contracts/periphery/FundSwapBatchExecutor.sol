// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import { OrderLib } from '../libraries/OrderLib.sol';
import { FundSwap } from '../FundSwap.sol';
import '../OrderStructs.sol';

/**
 * @notice A facade contract for FundSwap that allows for batch execution of public orders.
 */
contract FundSwapBatchExecutor is Context {
  using SafeERC20 for IERC20;
  FundSwap public fundswap;

  constructor(FundSwap _fundswap) {
    fundswap = _fundswap;
  }

  /**
   * @notice Fills a public order partially with permit.
   * @param orderFillRequests Order fill requests
   * @param amountToApprove amount to approve for permit of the maker buy token of the first order
   * in the batch
   * @param deadline deadline for permit
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return results array of output amounts
   */
  function batchFillPublicOrdersWithEntryPermit(
    OrderFillRequest[] memory orderFillRequests,
    uint256 amountToApprove,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public returns (SwapResult[] memory results) {
    PublicOrder memory order = fundswap.orderManager().getOrder(
      orderFillRequests[0].orderId
    );
    IERC20Permit(order.makerBuyToken).permit(
      _msgSender(),
      address(this),
      amountToApprove,
      deadline,
      v,
      r,
      s
    );

    return batchFillPublicOrders(orderFillRequests);
  }

  /**
   * @notice Fills a batch of public orders in a single transaction. This is useful for filling orders
   * from top to bottom of the order book i.e. combining multiple orders from the same token pair
   * into a single transaction.
   * Only whitelisted tokens can be used.
   * @param orderFillRequests Order fill requests
   */
  function batchFillPublicOrders(
    OrderFillRequest[] memory orderFillRequests
  ) public returns (SwapResult[] memory results) {
    results = new SwapResult[](orderFillRequests.length);

    for (uint256 i = 0; i < orderFillRequests.length; i++) {
      PublicOrder memory order = fundswap.orderManager().getOrder(
        orderFillRequests[i].orderId
      );
      _collectTokensNeededForSwap(orderFillRequests[i], order);
      IERC20(order.makerBuyToken).approve(address(fundswap), type(uint256).max);

      results[i] = OrderLib.isFillRequestPartial(orderFillRequests[i], order)
        ? fundswap.fillPublicOrderPartially(orderFillRequests[i], _msgSender())
        : fundswap.fillPublicOrder(orderFillRequests[i].orderId, _msgSender());
    }
  }

  /**
   * @notice Fills a batch of public orders in sequence in a single transaction. This is useful for
   * filling orders that depend on each other. For example, if you want to sell token A for token B
   * and then sell token B for token C, you can use this function to fill both orders in a single
   * transaction. This function will revert if any of the orders fail to fill.
   * Only whitelisted tokens can be used.
   * @param orderFillRequests Order fill requests
   */
  function batchFillPublicOrdersInSequence(
    OrderFillRequest[] memory orderFillRequests
  ) public returns (SwapResult[] memory results) {
    results = new SwapResult[](orderFillRequests.length);

    // First swap takes tokens from msg.sender and sends to this contract.
    // All the subsequent swaps take tokens from the results of the previous swaps.
    for (uint256 i = 0; i < orderFillRequests.length; i++) {
      PublicOrder memory order = fundswap.orderManager().getOrder(
        orderFillRequests[i].orderId
      );

      // Only tokens needed for the first swap in sequence have to be transfered to this contract
      if (i == 0) {
        _collectTokensNeededForSwap(orderFillRequests[i], order);
      }

      IERC20(order.makerBuyToken).approve(address(fundswap), type(uint256).max);

      results[i] = OrderLib.isFillRequestPartial(orderFillRequests[i], order)
        ? fundswap.fillPublicOrderPartially(orderFillRequests[i], address(this))
        : fundswap.fillPublicOrder(orderFillRequests[i].orderId, address(this));
    }

    // send last swap output back to msg.sender
    IERC20(results[results.length - 1].outputToken).safeTransfer(
      _msgSender(),
      results[results.length - 1].outputAmount
    );
  }

  function _collectTokensNeededForSwap(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order
  ) internal {
    (, , uint256 amountRequiredForSwap, ) = OrderLib.calculateOrderAmountsAfterFill(
      orderFillRequest,
      order
    );
    IERC20(order.makerBuyToken).safeTransferFrom(
      _msgSender(),
      address(this),
      amountRequiredForSwap
    );
  }
}
