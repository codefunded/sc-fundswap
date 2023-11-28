import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployFundSwap: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const fundswapDeployment = await deploy('FundSwap', {
    from: deployer,
    args: [],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(fundswapDeployment.address, fundswapDeployment.args!);
  }

  const fundswap = await ethers.getContractAt('FundSwap', fundswapDeployment.address);
  log(`Order manager deployed at ${await fundswap.orderManager()}`);
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(await fundswap.orderManager(), []);
  }

  const batchExecutorDeployment = await deploy('FundSwapBatchExecutor', {
    from: deployer,
    args: [fundswapDeployment.address],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(batchExecutorDeployment.address, batchExecutorDeployment.args!);
  }
  log('-----FundSwap deployed-----');
};

export default deployFundSwap;

deployFundSwap.tags = ['fundswap', 'core'];
