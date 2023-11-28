import { ethers } from 'hardhat';
import { Ownable2Step__factory } from '../../typechain-types';
import { getNetworkConfig } from '../../networkConfigs';

const TIMELOCK_ADDRESS = process.env.TIMELOCK_ADDRESS;
const TARGET_ADDRESS = process.env.TARGET_ADDRESS;
const MODE = process.env.MODE; // 'propose' or 'execute'

if (!TIMELOCK_ADDRESS) {
  throw new Error('TIMELOCK_ADDRESS not set');
}
if (!TARGET_ADDRESS) {
  throw new Error('TARGET_ADDRESS not set');
}

(async () => {
  const timelock = await ethers.getContractAt('TimelockController', TIMELOCK_ADDRESS);

  const networkConfig = getNetworkConfig(
    (await ethers.provider.getNetwork()).chainId.toString(),
  );

  const acceptOwnershipCall =
    Ownable2Step__factory.createInterface().encodeFunctionData('acceptOwnership');

  const salt = ethers.ZeroHash;

  const minDelay = await timelock.getMinDelay();

  const operationParams = [
    TARGET_ADDRESS,
    0n,
    acceptOwnershipCall,
    ethers.ZeroHash,
    salt,
  ] as const;

  const callId = await timelock.hashOperation(...operationParams);

  if (MODE === 'propose') {
    (await timelock.schedule(...operationParams, minDelay)).wait(
      networkConfig.confirmations,
    );
  }
  if (MODE === 'execute') {
    (await timelock.execute(...operationParams)).wait(networkConfig.confirmations);
  }

  switch (await timelock.getOperationState(callId)) {
    case 0n:
      console.log('Not scheduled');
      break;
    case 1n:
      console.log('Waiting for timelock to go off');
      break;
    case 2n:
      console.log('Ready for execution');
      break;
    case 3n:
      console.log('Done');
      break;
  }
})();
