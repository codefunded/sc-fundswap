import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployMocks: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  if (!networkConfig.deployMocks) {
    log('----- Skipped mocks deployment... -----');
    return;
  }

  const mockERC20Deployment = await deploy('MockERC20', {
    from: deployer,
    args: ['Mock ERC20', 'mERC20', ethers.parseEther('100000')],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });

  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(mockERC20Deployment.address, mockERC20Deployment.args!);
  }
  const mockUSDCDeployment = await deploy('MockUSDC', {
    from: deployer,
    args: [],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(mockUSDCDeployment.address, mockUSDCDeployment.args!);
  }

  const mockUSDC = await ethers.getContractAt('MockUSDC', mockUSDCDeployment.address);
  await mockUSDC.mint(deployer, ethers.parseEther('100000'));

  log('-----Mocks deployed-----');
};

export default deployMocks;

deployMocks.tags = ['mocks'];
