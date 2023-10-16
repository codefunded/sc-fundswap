// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '../OrderStructs.sol';

/**
 * @notice Library for managing orders
 */
library OrderLib {
  using Math for uint256;

  error OrderLib__InvalidOrderType();

  /**
   * @notice Checks if the fill request for a given order is partial
   * @param request order fill request to check
   * @param order underlying order
   */
  function isFillRequestPartial(
    OrderFillRequest memory request,
    PublicOrder memory order
  ) internal pure returns (bool isPartial) {
    return request.amountIn < order.amountWanted;
  }

  /**
   * @notice Calculates the amount of tokens offered and wanted after a partial fill of a given order
   * @param request order fill request
   * @param order underlying order
   * @return orderAmountWanted the amount of tokens wanted after the fill
   * @return orderAmountOffered the amount of tokens offered after the fill
   * @return inputAmount the amount of tokens needed for the fill
   * @return outputAmount the amount of tokens received from the fill
   */
  function calculateOrderAmountsAfterFill(
    OrderFillRequest memory request,
    PublicOrder memory order
  )
    internal
    pure
    returns (
      uint256 orderAmountWanted,
      uint256 orderAmountOffered,
      uint256 inputAmount,
      uint256 outputAmount
    )
  {
    uint256 amountWantedBeforeSwap = order.amountWanted;
    orderAmountWanted = order.amountWanted - request.amountIn;
    uint256 amountOfferedBeforeSwap = order.amountOffered;
    orderAmountOffered = order.amountOffered.mulDiv(
      orderAmountWanted,
      amountWantedBeforeSwap
    );
    inputAmount = request.amountIn;
    outputAmount = amountOfferedBeforeSwap - orderAmountOffered;

    return (orderAmountWanted, orderAmountOffered, inputAmount, outputAmount);
  }
}
