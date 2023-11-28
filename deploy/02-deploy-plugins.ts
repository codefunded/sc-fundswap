import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, getNamedAccounts } from 'hardhat';
import { DEFAULT_FEE } from '../utils/constants';
import { getNetworkConfig } from '../networkConfigs';
import { verifyContract } from '../utils/verifyContract';

const deployPlugins: DeployFunction = async function ({ deployments, getChainId }) {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const feeAggregatorPluginDeployment = await deploy('FeeAggregatorPlugin', {
    from: deployer,
    args: [DEFAULT_FEE],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(
      feeAggregatorPluginDeployment.address,
      feeAggregatorPluginDeployment.args!,
    );
  }

  const tokenWhitelistPluginDeployment = await deploy('TokenWhitelistPlugin', {
    from: deployer,
    args: [],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(
      tokenWhitelistPluginDeployment.address,
      tokenWhitelistPluginDeployment.args!,
    );
  }

  const fundswap = await ethers.getContractAt(
    'FundSwap',
    (await get('FundSwap')).address,
  );
  const activePlugins = await fundswap.getPlugins();
  if (!activePlugins.includes(feeAggregatorPluginDeployment.address)) {
    await (
      await fundswap.enablePlugin(feeAggregatorPluginDeployment.address, '0x')
    ).wait(networkConfig.confirmations);
  }

  if (!activePlugins.includes(tokenWhitelistPluginDeployment.address)) {
    await (
      await fundswap.enablePlugin(tokenWhitelistPluginDeployment.address, '0x')
    ).wait(networkConfig.confirmations);
  }

  log('-----Plugins deployed-----');
};

export default deployPlugins;

deployPlugins.tags = ['fundswap', 'plugins'];
