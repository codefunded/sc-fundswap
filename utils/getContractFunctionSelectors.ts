import { BaseContract, Contract, NamedFragment } from 'ethers';

/**
 * Utility function to get all external function selectors.
 * To get a single function selector, use:
 * contract.interface.getFunction('functionName')!.selector,
 * to get a sighash of a function, use:
 * contract.interface.getFunction('functionName')!.format('sighash'),
 */
export function getContractFunctionSelectors<T extends BaseContract>(contract: T) {
  const contractFunctions = contract.interface.fragments
    .filter((f) => f.type === 'function')
    .map((f) => contract.interface.getFunction((f as NamedFragment).name)!);

  return contractFunctions.map((f) => f.selector);
}
