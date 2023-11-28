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
  if ((await mockUSDC.balanceOf(deployer)) === 0n) {
    await (
      await mockUSDC.mint(deployer, ethers.parseUnits('100000', 6))
    ).wait(networkConfig.confirmations);
  }

  const faucet = await deploy('TestnetERC20Faucet', {
    from: deployer,
    args: [mockERC20Deployment.address, mockUSDCDeployment.address],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(faucet.address, faucet.args!);
  }

  const minterRole = await mockUSDC.MINTER_ROLE();
  if (!(await mockUSDC.hasRole(minterRole, faucet.address))) {
    await (
      await mockUSDC.grantRole(minterRole, faucet.address)
    ).wait(networkConfig.confirmations);
  }

  const mockERC20 = await ethers.getContractAt('MockERC20', mockERC20Deployment.address);
  if (!(await mockERC20.hasRole(minterRole, faucet.address))) {
    await (
      await mockERC20.grantRole(minterRole, faucet.address)
    ).wait(networkConfig.confirmations);
  }

  log('-----Mocks deployed-----');
};

export default deployMocks;

deployMocks.tags = ['mocks'];
