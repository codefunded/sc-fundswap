import { ethers } from 'hardhat';

export async function deployFundSwap() {
  const FundSwapFactory = await ethers.getContractFactory('FundSwap');
  const fundSwap = await FundSwapFactory.deploy();

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

  const PrivateOrderExecutorFactory = await ethers.getContractFactory(
    'FundSwapPrivateOrderExecutor',
  );

  const privateOrderExecutor = await PrivateOrderExecutorFactory.deploy(
    fundSwap.getAddress(),
  );

  return { fundSwap, fundSwapOrderManager, fundSwapBatchExecutor, privateOrderExecutor };
}
