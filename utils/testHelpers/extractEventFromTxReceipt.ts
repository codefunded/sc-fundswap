import { Contract, ContractTransactionReceipt } from 'ethers';

export const getEventFromTxReceipt = <T extends Contract>(
  contract: Contract,
  txReceipt: ContractTransactionReceipt,
  index = 0,
): T => {
  const parsedLog = contract.interface.parseLog(txReceipt.logs[index] as any);
  return parsedLog?.args as unknown as T;
};
