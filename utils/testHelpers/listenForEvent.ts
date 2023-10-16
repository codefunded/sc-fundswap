import { Contract, ContractEvent } from 'ethers';

export const listenForEvent = async <T extends Contract>(
  contract: T,
  eventName: string,
): Promise<ContractEvent> =>
  new Promise((resolve, reject) => {
    contract.once(eventName, (...args) => {
      resolve(args.at(-1)); // event is always the last argument
    });

    setTimeout(() => {
      reject(new Error('timeout'));
    }, 10000);
  });
