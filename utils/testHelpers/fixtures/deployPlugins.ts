import { ethers } from 'hardhat';
import { FundSwap } from '../../../typechain-types';
import { DEFAULT_FEE } from '../../constants';

export async function deployPlugins(fundSwap: FundSwap) {
  const FeeAggregatorPluginFactory =
    await ethers.getContractFactory('FeeAggregatorPlugin');
  const feeAggregatorPlugin = await FeeAggregatorPluginFactory.deploy(DEFAULT_FEE);

  const TokenWhitelistPluginFactory =
    await ethers.getContractFactory('TokenWhitelistPlugin');
  const tokenWhitelistPlugin = await TokenWhitelistPluginFactory.deploy();

  await fundSwap.enablePlugin(feeAggregatorPlugin.getAddress(), '0x');
  await fundSwap.enablePlugin(tokenWhitelistPlugin.getAddress(), '0x');

  return {
    feeAggregatorPlugin,
    tokenWhitelistPlugin,
  };
}
