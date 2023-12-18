// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { ERC721 } from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import { ERC721Enumerable } from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import { ERC721Burnable } from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { Base64 } from '@openzeppelin/contracts/utils/Base64.sol';
import { Strings } from '@openzeppelin/contracts/utils/Strings.sol';
import { PublicOrder } from './OrderStructs.sol';
import { OrderSignatureVerifierLib } from './libraries/OrderSignatureVerifierLib.sol';

/**
 * @title FundSwapOrderManager
 * @notice Manages the creation and storage of public orders which are represented as ERC721 tokens.
 */
contract FundSwapOrderManager is ERC721, ERC721Enumerable, ERC721Burnable, Ownable {
  error FundSwapOrderManager_OrderNotFound(uint256 tokenId);
  error FundSwapOrderManager__OrderAlreadyExists(uint256 tokenId);

  /// @dev tokenHash => order data
  mapping(uint256 => PublicOrder) public orders;

  constructor() ERC721('FundSwap order', 'FSO') Ownable(_msgSender()) {}

  /**
   * gets the order data for a given token ID
   * @param tokenId the has of the token to get the order data for
   */
  function getOrder(uint256 tokenId) public view returns (PublicOrder memory) {
    return orders[tokenId];
  }

  /**
   * Creates a new public order and mints an ERC721 token representing it
   * @param to the address to mint the token to
   * @param order the order data
   * @return tokenId minted token number
   */
  function safeMint(
    address to,
    PublicOrder calldata order
  ) public onlyOwner returns (uint256 tokenId) {
    bytes32 tokenHash = OrderSignatureVerifierLib.hashPublicOrder(order);
    tokenId = uint256(tokenHash);
    if (_doesOrderExists(tokenId)) {
      revert FundSwapOrderManager__OrderAlreadyExists(tokenId);
    }
    orders[tokenId] = order;
    _safeMint(to, tokenId);
  }

  /**
   * Burns an ERC721 token representing a public order and deletes the order data
   * @param tokenId the id of the token to burn
   */
  function burn(uint256 tokenId) public override onlyOwner {
    delete orders[tokenId];
    super._burn(tokenId);
  }

  /**
   * Updates the order data for a public order. It is used to update orders in case when anohter user issued a
   * market order that partially filled the given public order.
   * @param tokenId the id of the token to update
   * @param order the new order data
   */
  function updateOrder(uint256 tokenId, PublicOrder memory order) public onlyOwner {
    if (!_doesOrderExists(tokenId)) {
      revert FundSwapOrderManager_OrderNotFound(tokenId);
    }
    orders[tokenId] = order;
  }

  /**
   * Returns the JSON representation of the public order data for a given token id.
   * @param tokenId the id of the token to get the order data for
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    super._requireOwned(tokenId);

    PublicOrder memory order = orders[tokenId];

    string memory json = Base64.encode(
      bytes(
        string(
          abi.encodePacked(
            '{"name": "',
            Strings.toString(order.makerSellTokenAmount),
            ' ',
            ERC20(order.makerSellToken).symbol(),
            ' => ',
            Strings.toString(order.makerBuyTokenAmount),
            ' ',
            ERC20(order.makerBuyToken).symbol(),
            '",',
            '"attributes": [',
            '{"trait_type": "Deadline", "value": "',
            Strings.toString(order.deadline),
            '"}',
            ']'
            '}'
          )
        )
      )
    );
    return string(abi.encodePacked('data:application/json;base64,', json));
  }

  function _doesOrderExists(uint256 tokenId) private view returns (bool) {
    return
      orders[tokenId].makerBuyToken != address(0) &&
      orders[tokenId].makerSellToken != address(0);
  }

  // following functions are overrides required by Solidity.

  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal virtual override(ERC721, ERC721Enumerable) returns (address) {
    return super._update(to, tokenId, auth);
  }

  function _increaseBalance(
    address account,
    uint128 value
  ) internal virtual override(ERC721, ERC721Enumerable) {
    super._increaseBalance(account, value);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721, ERC721Enumerable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
