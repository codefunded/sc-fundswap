import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ignition';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import { env } from './env';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.23',
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1000,
            details: {
              yulDetails: {
                optimizerSteps: 'u',
              },
            },
          },
        },
      },
    ],
  },
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      chainId: 31337,
    },
    hardhat: {
      initialBaseFeePerGas: 0,
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
      url: env.POLYGON_MUMBAI_RPC,
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
  etherscan: {
    apiKey: env.POLYGONSCAN_API_KEY,
  },
};

export default config;
