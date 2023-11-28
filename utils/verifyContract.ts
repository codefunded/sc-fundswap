import { run } from 'hardhat';

export const verifyContract = async (
  contractAddress: string,
  constructorArguments: any[],
) => {
  console.log('Verifying contract...');
  let tries = 1;
  while (tries++ <= 5) {
    try {
      await run('verify:verify', {
        address: contractAddress,
        constructorArguments,
      });
      break;
    } catch (error) {
      if ((error as Error).message.includes('already verified')) {
        console.log('Contract already verified!');
        break;
      } else {
        console.log(error);
      }
    }
  }
  if (tries === 5) {
    console.log('Contract verification failed');
  }
};
