type NetworkConfig = {
  chainId: number;
  name: string;
  deployMocks: boolean;
  existingContracts: {
    gelatoAutomate?: string;
  };
  confirmations: number;
  shouldVerifyContracts: boolean;
};

export const getNetworkConfig = (chainId: string): NetworkConfig => {
  const networkConfig = NETWORK_CONFIGS[chainId];
  if (!networkConfig) {
    throw new Error(`No network config found for chainId ${chainId}`);
  }
  return networkConfig;
};

export const NETWORK_CONFIGS: { [chainId: string]: NetworkConfig | undefined } = {
  '31337': {
    chainId: 31337,
    name: 'localhost/hardhat',
    deployMocks: true,
    existingContracts: {
      gelatoAutomate: '0x527a819db1eb0e34426297b03bae11F2f8B3A19E',
    },
    confirmations: 1,
    shouldVerifyContracts: false,
  },
  '137': {
    chainId: 137,
    name: 'polygon',
    deployMocks: false,
    existingContracts: {
      gelatoAutomate: '0x527a819db1eb0e34426297b03bae11F2f8B3A19E',
    },
    confirmations: 20,
    shouldVerifyContracts: true,
  },
  '80001': {
    chainId: 80001,
    name: 'mumbai',
    deployMocks: true,
    existingContracts: {
      gelatoAutomate: '0xB3f5503f93d5Ef84b06993a1975B9D21B962892F',
    },
    confirmations: 3,
    shouldVerifyContracts: true,
  },
};
