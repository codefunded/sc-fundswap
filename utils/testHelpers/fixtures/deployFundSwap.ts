import { ethers } from 'hardhat';
import { DEFAULT_FEE } from '../../constants';

export async function deployFundSwap() {
  const FundSwapFactory = await ethers.getContractFactory('FundSwap');
  const fundSwap = await FundSwapFactory.deploy(DEFAULT_FEE);

  const fundSwapOrderManagerAddress = await fundSwap.orderManager();
  const fundSwapOrderManager = await ethers.getContractAt(
    'FundSwapOrderManager',
    fundSwapOrderManagerAddress,
  );

  const FundSwapBatchExecutorFactory = await ethers.getContractFactory(
    'FundSwapBatchExecutor',
  );
  const fundSwapBatchExecutor = await FundSwapBatchExecutorFactory.deploy(
    fundSwap.getAddress(),
  );

  return { fundSwap, fundSwapOrderManager, fundSwapBatchExecutor };
}
