// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';

/// @title Mock ERC20 mintable token for testing purposes
contract MockERC20 is ERC20, ERC20Permit {
  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _initialSupply
  ) ERC20(_name, _symbol) ERC20Permit(_name) {
    _mint(_msgSender(), _initialSupply);
  }
}
