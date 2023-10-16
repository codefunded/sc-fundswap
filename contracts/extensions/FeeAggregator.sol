// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '../libraries/PairLib.sol';

error FeeAggregator__FeeCannotExceed100Percent();
error FeeAggregator__FeeAmountIsBiggerThanAmount();
error FeeAggregator__NoBaseFeeAmountForPair();

/**
 * @notice FeeLevel is a struct that contains a fee percentage and a minimum amount of asset
 * for a fee to be applied. Fee is applied to the amount that is bigger than the minimum amount.
 * @param minAmount minimum amount for a fee level
 * @param fee fee percentage for a fee level
 */
struct FeeLevel {
  uint256 minAmount;
  uint16 fee;
}

/**
 * @notice PairFeeLevels is a struct that contains a pair of assets and a list of fee levels for this pair.
 */
struct PairFeeLevels {
  address asset1;
  address asset2;
  FeeLevel[] feeLevels;
}

/**
 * @notice FeeAggregator is a contract that aggregates fees from asset transactions.
 * It allows specifying 3 types of fees: pair fee, asset fee or a default fee.
 * On each trade, FeeAggregator contract checks if there is a fee specified for a given pair.
 * If there's no fee specified for that pair, the contract checks if the asset that fee is about
 * to be paid in has a fee specified. Default fee is used when no fee is specified for a given pair
 * nor for a given asset.
 * @dev Fee percentage is denominated in basis points (1/100th of a percent).
 */
abstract contract FeeAggregator is Ownable {
  using SafeERC20 for IERC20;
  using EnumerableMap for EnumerableMap.AddressToUintMap;
  using EnumerableSet for EnumerableSet.AddressSet;

  event DefaultFeeUpdated(uint16 newfee, uint16 previousFee);
  event FeeForAssetUpdated(address indexed asset, uint16 newfee, uint16 previousFee);
  event FeesWithdrawn(address token, uint256 amount);
  event FeeLevelsForPairUpdated(address indexed assetA, address indexed assetB);

  /// @dev MAX_FEE is 100% in basis points
  uint16 public constant MAX_FEE = 10000;
  /// @notice Default fee for each asset. It is used when no fee is specified for a given asset
  uint16 public defaultFee;
  /// @notice Fee that is specific to a given asset. It overrides the default fee.
  EnumerableMap.AddressToUintMap private feeForAsset;
  /**
   * @notice Fees that are specific to a given pair of assets. It overrides the default fee
   * and a fee that is set for a particular asset.
   */
  mapping(address => mapping(address => FeeLevel[])) public feeForPair;
  /// @notice List of pairs for each asset
  mapping(address => EnumerableSet.AddressSet) private pairsForAsset;
  /// @notice List of all assets that have a specified fee for at least one pair
  EnumerableSet.AddressSet private assetsWithPairFee;
  /// @notice Amount of fees collected for each token
  mapping(address => uint256) public collectedFeesInToken;

  constructor(uint16 _defaultFee) {
    defaultFee = _defaultFee;
  }

  /**
   * @notice Sets the default fee for all assets.
   * @param _fee fee in basis points (1/100th of a percent)
   */
  function setDefaultFee(uint16 _fee) external onlyOwner {
    if (_fee > MAX_FEE) {
      revert FeeAggregator__FeeCannotExceed100Percent();
    }
    defaultFee = _fee;
    emit DefaultFeeUpdated(_fee, defaultFee);
  }

  /**
   * @notice Sets the fee for a given asset.
   * @param _asset asset address
   * @param _fee fee in basis points (1/100th of a percent)
   */
  function setFeeForAsset(address _asset, uint16 _fee) external onlyOwner {
    if (_fee > MAX_FEE) {
      revert FeeAggregator__FeeCannotExceed100Percent();
    }
    feeForAsset.set(_asset, _fee);
    emit FeeForAssetUpdated(_asset, _fee, defaultFee);
  }

  /**
   * @notice Sets the fee levels for a given pair of assets.
   * @param _asset1 first asset address
   * @param _asset2 second asset address
   * @param _feeLevels array of fee levels. First element should describe a fee when swap amount is 0.
   */
  function setFeeLevelsForPair(
    address _asset1,
    address _asset2,
    FeeLevel[] calldata _feeLevels
  ) external onlyOwner {
    (address asset1, address asset2) = PairLib.getPairInOrder(_asset1, _asset2);

    if (_feeLevels.length == 0) {
      feeForPair[asset1][asset2] = new FeeLevel[](0);
      pairsForAsset[asset1].remove(asset2);
      if (pairsForAsset[asset1].length() == 0) {
        assetsWithPairFee.remove(asset1);
      }
      pairsForAsset[asset2].remove(asset1);
      if (pairsForAsset[asset2].length() == 0) {
        assetsWithPairFee.remove(asset2);
      }
      emit FeeLevelsForPairUpdated(asset1, asset2);
      return;
    }

    if (_feeLevels[0].minAmount != 0) {
      revert FeeAggregator__NoBaseFeeAmountForPair();
    }

    for (uint256 i = 0; i < _feeLevels.length; i++) {
      if (_feeLevels[i].fee > MAX_FEE) {
        revert FeeAggregator__FeeCannotExceed100Percent();
      }
    }

    feeForPair[asset1][asset2] = _feeLevels;
    pairsForAsset[asset1].add(asset2);
    pairsForAsset[asset2].add(asset1);
    assetsWithPairFee.add(asset1);
    assetsWithPairFee.add(asset2);
    emit FeeLevelsForPairUpdated(asset1, asset2);
  }

  /**
   * @notice Withdraws fees for a given token to the owner. If _amount is greater than collected fees,
   * all collected fees are withdrawn.
   * @param _token token address
   * @param _amount amount of fees to withdraw
   */
  function withdrawFees(address _token, uint256 _amount) external onlyOwner {
    uint256 collectedFees = collectedFeesInToken[_token];

    // if amount is greater than collected fees, withdraw all collected fees
    uint256 amountToWithdraw = _amount;
    if (amountToWithdraw > collectedFees) {
      amountToWithdraw = collectedFees;
    }

    collectedFeesInToken[_token] -= amountToWithdraw;
    IERC20(_token).safeTransfer(_msgSender(), amountToWithdraw);

    emit FeesWithdrawn(_token, amountToWithdraw);
  }

  /**
   * @notice Returns the fee for a given asset. If there's no fee for a given asset, the default fee
   * is returned.
   * @param _asset asset address
   * @return fee for a given asset
   */
  function getFeeForAsset(address _asset) public view returns (uint16) {
    if (feeForAsset.contains(_asset)) {
      return uint16(feeForAsset.get(_asset));
    }
    return defaultFee;
  }

  /**
   * @notice Returns all assets that have a specific fee assigned to them. Default fee is not included.
   * @return assets that have a specific fee assigned to them
   * @return fees fee amount for each asset
   */
  function getFeesForAllAssets()
    external
    view
    returns (address[] memory assets, uint256[] memory fees)
  {
    uint256 length = feeForAsset.length();
    assets = new address[](length);
    fees = new uint256[](length);
    for (uint256 i = 0; i < length; i++) {
      (assets[i], fees[i]) = feeForAsset.at(i);
    }
  }

  /**
   * @notice Returns the fee levels for a given pair of assets. If there's no fee for a given pair,
   * empty array is returned.
   * @param _asset1 first asset address
   * @param _asset2 second asset address
   * @return feeLevels fee levels for a given pair of assets
   */
  function getFeeLevelsForPair(
    address _asset1,
    address _asset2
  ) public view returns (FeeLevel[] memory feeLevels) {
    (address asset1, address asset2) = PairLib.getPairInOrder(_asset1, _asset2);
    return feeForPair[asset1][asset2];
  }

  /**
   * @notice Returns all pairs that have a specific fee assigned to them. Default fee is not included.
   * @return pairsWithFees pairs that have a specific fee assigned to them
   */
  function getFeeLevelsForAllPairs()
    external
    view
    returns (PairFeeLevels[] memory pairsWithFees)
  {
    if (assetsWithPairFee.length() == 0) {
      return new PairFeeLevels[](0);
    }

    PairFeeLevels[] memory tempPairsWithFees = new PairFeeLevels[](
      PairLib.getMaxAmountOfPairs(assetsWithPairFee.length())
    );
    uint256 tempPairsIndex = 0;

    for (uint256 i = 0; i < assetsWithPairFee.length(); i++) {
      address asset1 = assetsWithPairFee.at(i);
      for (uint256 j = 0; j < pairsForAsset[asset1].length(); j++) {
        address asset2 = pairsForAsset[asset1].at(j);
        (address sortedAsset1, ) = PairLib.getPairInOrder(asset1, asset2);
        if (sortedAsset1 == asset1 && feeForPair[asset1][asset2].length > 0) {
          tempPairsWithFees[tempPairsIndex] = PairFeeLevels({
            asset1: asset1,
            asset2: asset2,
            feeLevels: feeForPair[asset1][asset2]
          });
          tempPairsIndex++;
        }
      }
    }

    pairsWithFees = new PairFeeLevels[](tempPairsIndex);
    for (uint256 i = 0; i < tempPairsIndex; i++) {
      pairsWithFees[i] = tempPairsWithFees[i];
    }
  }

  /**
   * @notice Calculates the amount with deducted fee. This fuction takes into account the fee
   * for a specific asset and falls back to the default fee if no fee is specified for a given asset.
   * @param _assetPayableAsFee address of the asset in which the fee is paid
   * @param _secondAsset second asset address, can be address(0) if there's no second asset
   * @param _amount amount of asset
   * @return amountWithDeductedFee amount of asset with deducted fee
   */
  function _calculateAmountWithDeductedFee(
    address _assetPayableAsFee,
    address _secondAsset,
    uint256 _amount
  ) internal view returns (uint256 amountWithDeductedFee) {
    uint256 feeAmount = _calculateFeeAmount(_assetPayableAsFee, _secondAsset, _amount);
    amountWithDeductedFee = _amount - feeAmount;
  }

  /**
   * @notice Marks given amount of fees as collected for a given token.
   * @param _token token address
   * @param _feeAmount amount of fees to accrue
   */
  function _accrueFeeForToken(address _token, uint256 _feeAmount) internal {
    if (_feeAmount > 0) {
      collectedFeesInToken[_token] += _feeAmount;
    }
  }

  /**
   * @notice Calculates the fee amount for a given asset and input amount.
   * @param _assetPayableAsFee token address in which the fee is paid
   * @param _secondAsset second token address
   * @param _amount amount of fee
   */
  function _calculateFeeAmount(
    address _assetPayableAsFee,
    address _secondAsset,
    uint256 _amount
  ) internal view returns (uint256 feeAmount) {
    uint16 fee = 0;

    // first check if there's a fee for a given pair
    (address asset1, address asset2) = PairLib.getPairInOrder(
      _assetPayableAsFee,
      _secondAsset
    );
    FeeLevel[] memory feeLevels = feeForPair[asset1][asset2];
    if (feeLevels.length != 0) {
      uint256 lowestFee = feeLevels[0].fee;
      // Iterate through the feeLevels array and find the appropriate fee level based on the amount
      for (uint256 i = 0; i < feeLevels.length; i++) {
        if (_amount >= feeLevels[i].minAmount && feeLevels[i].fee < lowestFee) {
          lowestFee = feeLevels[i].fee;
        }
      }
      fee = uint16(lowestFee);
    } else {
      // if there's no fee for a given pair, check if there's a fee for a given asset
      // if there's no fee for a given asset, getFeeForAsset returns the default fee
      fee = getFeeForAsset(_assetPayableAsFee);
    }

    if (fee == 0) {
      return 0;
    }

    feeAmount = (_amount * fee) / MAX_FEE;
    if (feeAmount > _amount) {
      revert FeeAggregator__FeeAmountIsBiggerThanAmount();
    }
  }
}
