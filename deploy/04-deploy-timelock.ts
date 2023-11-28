import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, getNamedAccounts } from 'hardhat';
import { getNetworkConfig } from '../networkConfigs';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { verifyContract } from '../utils/verifyContract';

const deployTimelock: DeployFunction = async function ({ deployments, getChainId }) {
  const { deploy, log, get } = deployments;
  const chainId = await getChainId();
  const { deployer } = await getNamedAccounts();
  const networkConfig = getNetworkConfig(chainId);

  // only deploy timelock on polygon PoS mainnet
  if (chainId !== '137') {
    log('-----Skipped timelock deployment-----');
    return;
  }

  const timelockDeployment = await deploy('TimelockController', {
    from: deployer,
    args: [time.duration.hours(24), [deployer], [deployer], deployer],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(timelockDeployment.address, timelockDeployment.args!);
  }
  log('-----Timelock deployed-----');

  const feeAggregatorPlugin = await ethers.getContractAt(
    'FeeAggregatorPlugin',
    (await get('FeeAggregatorPlugin')).address,
  );
  if ((await feeAggregatorPlugin.owner()) === deployer) {
    await (
      await feeAggregatorPlugin.transferOwnership(timelockDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  const tokenWhitelistPlugin = await ethers.getContractAt(
    'TokenWhitelistPlugin',
    (await get('TokenWhitelistPlugin')).address,
  );
  if ((await tokenWhitelistPlugin.owner()) === deployer) {
    await (
      await tokenWhitelistPlugin.transferOwnership(timelockDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  const fundswap = await ethers.getContractAt(
    'FundSwap',
    (await get('FundSwap')).address,
  );
  if (
    !(await fundswap.hasRole(
      await fundswap.DEFAULT_ADMIN_ROLE(),
      timelockDeployment.address,
    ))
  ) {
    await (
      await fundswap.grantRole(
        await fundswap.DEFAULT_ADMIN_ROLE(),
        timelockDeployment.address,
      )
    ).wait(networkConfig.confirmations);
  }
  if (
    !(await fundswap.hasRole(await fundswap.TREASURY_OWNER(), timelockDeployment.address))
  ) {
    await (
      await fundswap.grantRole(
        await fundswap.TREASURY_OWNER(),
        timelockDeployment.address,
      )
    ).wait(networkConfig.confirmations);
  }
  if (await fundswap.hasRole(await fundswap.DEFAULT_ADMIN_ROLE(), deployer)) {
    await (
      await fundswap.renounceRole(await fundswap.DEFAULT_ADMIN_ROLE(), deployer)
    ).wait(networkConfig.confirmations);
  }

  log('-----Ownership transferred to Timelock contract-----');
};

export default deployTimelock;

deployTimelock.tags = ['fundswap', 'timelock'];
