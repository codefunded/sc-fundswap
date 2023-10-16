import { run } from 'hardhat';

export const verifyContract = async (
  contractAddress: string,
  constructorArguments: any[],
) => {
  console.log('Verifying contract...');
  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments,
    });
  } catch (error) {
    if ((error as Error).message.includes('already verified')) {
      console.log('Contract already verified!');
    } else {
      console.log(error);
    }
  }
};
