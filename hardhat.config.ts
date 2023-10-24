import { HardhatUserConfig } from 'hardhat/config';
// import 'hardhat-diamond-abi';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import { env } from './env';
// import { createDiamondDeduper } from './utils/diamondDeduper';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.21',
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      forking: {
        url: env.POLYGON_MAINNET_RPC,
      },
      chainId: 31337,
    },
    hardhat: {
      forking: {
        url: env.POLYGON_MAINNET_RPC,
        blockNumber: 43204774,
      },
      chainId: 31337,
      accounts: [
        {
          privateKey: env.PRIVATE_KEY,
          balance: '100315414324631460577',
        },
        {
          privateKey: env.PRIVATE_KEY_2,
          balance: '100000000000000000000',
        },
      ],
    },
    polygon: {
      url: env.POLYGON_MAINNET_RPC,
      chainId: 137,
      accounts: [env.PRIVATE_KEY],
    },
    mumbai: {
      url: env.POLYGON_MUMBAI_RPC!,
      chainId: 80001,
      gasPrice: 35000000000,
      accounts: [env.PRIVATE_KEY],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  // diamondAbi: {
  //   name: 'DiamondAggregate',
  //   filter: createDiamondDeduper(),
  // },
};

export default config;
