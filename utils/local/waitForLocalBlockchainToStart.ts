import { ethers } from 'hardhat';

export const waitForLocalBlockchainToStart = async () => {
  while (true) {
    const isStarted = await isLocalBlockchainStarted();
    if (isStarted) {
      return;
    }
    await new Promise((res) => setTimeout(() => res({}), 1000));
  }
};

export const isLocalBlockchainStarted = async () => {
  try {
    await ethers.provider.getBlockNumber();
    return true;
  } catch (e) {
    return false;
  }
};

(async () => {
  await waitForLocalBlockchainToStart();
  console.log('Local blockchain started');
})();
