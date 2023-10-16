import { ethers } from 'hardhat';

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const RECIPIENT = process.env.RECIPIENT;
const AMOUNT = process.env.AMOUNT;

async function main() {
  if (TOKEN_ADDRESS === undefined) {
    throw new Error('TOKEN_ADDRESS must be set');
  }
  if (RECIPIENT === undefined) {
    throw new Error('RECIPIENT must be set');
  }
  if (AMOUNT === undefined) {
    throw new Error('AMOUNT must be set');
  }

  const usdc = await ethers.getContractAt('IERC20', TOKEN_ADDRESS);
  await usdc.transfer(RECIPIENT, ethers.parseUnits(AMOUNT, 6));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
