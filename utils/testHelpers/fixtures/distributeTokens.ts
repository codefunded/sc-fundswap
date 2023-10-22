import { ethers } from 'hardhat';

const ONE_THOUSAND = ethers.parseUnits('1000', 'ether');

export async function distributeTokens() {
  const [user1, user2] = await ethers.getSigners();
  const tokenFactory = await ethers.getContractFactory('MockERC20');
  const erc20Token = await tokenFactory.deploy(
    'Mock ERC20 Token',
    'MET',
    ethers.parseEther('10000000'),
  );
  await erc20Token.transfer(user2.address, ONE_THOUSAND);

  const usdcFactory = await ethers.getContractFactory('MockUSDC');
  const usdcToken = await usdcFactory.deploy();
  await usdcToken.mint(user1.address, ethers.parseUnits('2000', 6));
  await usdcToken.transfer(user2.address, ethers.parseUnits('1000', 6));

  const wmaticToken = await tokenFactory.deploy(
    'Wrapped Matic',
    'WMATIC',
    ethers.parseEther('10000000'),
  );
  await wmaticToken.transfer(user2.address, ONE_THOUSAND);

  return {
    erc20Token,
    usdcToken,
    wmaticToken,
  };
}
