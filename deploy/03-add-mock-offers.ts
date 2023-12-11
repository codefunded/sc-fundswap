import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, getNamedAccounts } from 'hardhat';
import { MAX_UINT256 } from '../utils/constants';
import { getNetworkConfig } from '../networkConfigs';

const deployMockOffers: DeployFunction = async function ({ deployments, getChainId }) {
  const { log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  if (!networkConfig.deployMocks) {
    log('----- Skipped adding mock offers... -----');
    return;
  }

  const mockUSDCAddress = (await get('MockUSDC')).address;
  const mockERC20Address = (await get('MockERC20')).address;
  const mockUSDC = await ethers.getContractAt('MockUSDC', mockUSDCAddress);
  const mockERC20 = await ethers.getContractAt('MockERC20', mockERC20Address);
  const fundswap = await ethers.getContractAt(
    'FundSwap',
    (await get('FundSwap')).address,
  );
  const tokenWhitelistPluginAddress = (await get('TokenWhitelistPlugin')).address;
  const tokenWhitelistPlugin = await ethers.getContractAt(
    'TokenWhitelistPlugin',
    tokenWhitelistPluginAddress,
  );

  if ((await mockUSDC.allowance(deployer, await fundswap.getAddress())) === 0n) {
    await (
      await mockUSDC.approve(fundswap.getAddress(), MAX_UINT256)
    ).wait(networkConfig.confirmations);
  }
  if ((await mockERC20.allowance(deployer, await fundswap.getAddress())) === 0n) {
    await (
      await mockERC20.approve(fundswap.getAddress(), MAX_UINT256)
    ).wait(networkConfig.confirmations);
  }
  if (!(await tokenWhitelistPlugin.isTokenWhtelisted(mockUSDCAddress))) {
    await (
      await tokenWhitelistPlugin.addTokenToWhitelist(mockUSDCAddress)
    ).wait(networkConfig.confirmations);
  }
  if (!(await tokenWhitelistPlugin.isTokenWhtelisted(mockERC20Address))) {
    await (
      await tokenWhitelistPlugin.addTokenToWhitelist(mockERC20Address)
    ).wait(networkConfig.confirmations);
  }
  const orderManager = await ethers.getContractAt(
    'FundSwapOrderManager',
    await fundswap.orderManager(),
  );
  if ((await orderManager.tokenIdCounter()) === 0n) {
    await (
      await fundswap.createPublicOrder({
        makerSellToken: mockUSDCAddress,
        makerSellTokenAmount: ethers.parseUnits('1', 6),
        makerBuyToken: mockERC20Address,
        makerBuyTokenAmount: ethers.parseEther('2'),
        deadline: 0,
        creationTimestamp: Math.floor(Date.now() / 1000),
      })
    ).wait(networkConfig.confirmations);
    await (
      await fundswap.createPublicOrder({
        makerSellToken: mockERC20Address,
        makerSellTokenAmount: ethers.parseEther('10'),
        makerBuyToken: mockUSDCAddress,
        makerBuyTokenAmount: ethers.parseUnits('15', 6),
        deadline: 0,
        creationTimestamp: Math.floor(Date.now() / 1000),
      })
    ).wait(networkConfig.confirmations);
    await (
      await fundswap.createPublicOrder({
        makerSellToken: mockERC20Address,
        makerSellTokenAmount: ethers.parseEther('10'),
        makerBuyToken: mockUSDCAddress,
        makerBuyTokenAmount: ethers.parseUnits('25', 6),
        deadline: 0,
        creationTimestamp: Math.floor(Date.now() + 1 / 1000),
      })
    ).wait(networkConfig.confirmations);
  }

  log('-----Mock offers added-----');
};

export default deployMockOffers;

deployMockOffers.tags = ['mocks'];
