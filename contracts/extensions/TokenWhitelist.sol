// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

error TokenWhitelist__TokenNotWhitelisted(address token);

/**
 * @notice Allows to add and remove tokens from a whitelist.
 */
abstract contract TokenWhitelist is Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;

  event TokenAddedToWhitelist(address token);
  event TokenRemovedFromWhitelist(address token);

  EnumerableSet.AddressSet private whitelistedTokens;

  /**
   * @notice Checks if a token is whitelisted.
   * @param token token address to check
   */
  modifier onlyWhitelistedTokens(address token) {
    if (!isTokenWhtelisted(token) || token == address(0)) {
      revert TokenWhitelist__TokenNotWhitelisted(token);
    }
    _;
  }

  /**
   * @notice Checks if a token is whitelisted.
   * @param token token address to check
   * @return true if the token is whitelisted, false otherwise
   */
  function isTokenWhtelisted(address token) public view returns (bool) {
    return whitelistedTokens.contains(token);
  }

  /**
   * @notice Adds a token to the whitelist. If the token is already whitelisted, it does nothing.
   * @param token token address to add to the whitelist
   */
  function addTokenToWhitelist(address token) public onlyOwner {
    whitelistedTokens.add(token);
    emit TokenAddedToWhitelist(token);
  }

  /**
   * @notice Removes a token from the whitelist. If the token is not whitelisted, it does nothing.
   * @param token token address to remove from the whitelist
   */
  function removeTokenFromWhitelist(address token) public onlyOwner {
    whitelistedTokens.remove(token);
    emit TokenRemovedFromWhitelist(token);
  }

  /**
   * @notice Returns a list of whitelisted tokens.
   * @return list of whitelisted tokens
   */
  function getWhitelistedTokens() public view returns (address[] memory) {
    return whitelistedTokens.values();
  }
}
