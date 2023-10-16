// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';
import '../OrderStructs.sol';

error OrderSignatureVerifier__InvalidOrderHash();

/**
 * @notice Verifies the signature of a private order and hashes the order data in the way that
 * later the signer can be recovered from the signature.
 */
abstract contract OrderSignatureVerifier {
  /**
   * @notice Returns the chain id of the current network
   * @return chainId chain id of the current network
   */
  function _getChainId() internal view virtual returns (uint256 chainId) {
    assembly {
      chainId := chainid()
    }
    return chainId;
  }

  /**
   * @notice Hashes the order data in the way that later the signer can be recovered from the signature.
   * @param order the order data
   */
  function hashOrder(PrivateOrder memory order) internal view returns (bytes32) {
    return
      keccak256(
        abi.encodePacked(
          _getChainId(),
          order.creator,
          order.deadline,
          order.offeredToken,
          order.amountOffered,
          order.wantedToken,
          order.amountWanted,
          order.recipient,
          order.creationTimestamp
        )
      );
  }

  /**
   * @notice Verifies if the signature matches private order data and a hash of the order data.
   * @param _order order data
   * @param _orderHash hash of the order data
   * @param _signature signature of the order data
   */
  function verifyOrder(
    PrivateOrder memory _order,
    bytes32 _orderHash,
    bytes memory _signature
  ) public view returns (bool) {
    if (hashOrder(_order) != _orderHash) {
      revert OrderSignatureVerifier__InvalidOrderHash();
    }

    bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(_orderHash);

    return
      SignatureChecker.isValidSignatureNow(
        _order.creator,
        ethSignedMessageHash,
        _signature
      );
  }
}
