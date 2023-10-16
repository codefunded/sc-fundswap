# FundSwap

FundSwap is a decentralized spot exchange for ERC-20 tokens compatible with EVM chains.
This solution is targeted for projects that don't have the money required to create a reasonable liquidity pool for classic DEX like Uniswap, but they still want to give their users a way to exchange tokens peer-to-peer in a permissionless way, without a need of intermediaries.

FundSwap consists of a set of smart contracts that allow for settlements on-chain and a webpage interface.

## Local development

In order to run FundSwap locally:

1. install the dependencies with `yarn`
2. then run `run yarn dev` in the repo root. This command will compile smart contracts, then start a local hardhat node, deploy the contracts to your local testnet and then boot up the Next.js frontend.

> **IMPORTANT** When you connect your Metamask to the local testnet, make sure to reset your wallet nonce, otherwise you will get an error when trying to interact with the chain. In order to do that, go to Metamask settings, then `Advanced` and click on the red button `Clear activity and nonce data`. You have to do this every time you restart the local testnet.

## How it works

The logic behind exchange is divided into three contracts: `FundSwap.sol`, `FundSwapOrderManager.sol` and `FundSwapBatchExecutor.sol`. FundSwap is an actual exchange where all the actions happen i.e., creating an order, filling an existing order or cancelling an order. FundSwapOrderManager is an ERC-721 contract and each NFT represents a single order containing all the data specific for a particular order. FundSwapBatchExecutor is resposnible for executing multiple orders in a single transaction.


# Contracts subrepo

This is a subrepo for Solidity contracts. There are some example contracts in `contracts` folder like simple `Message.sol` contract, upgradedable diamonds, utils and gelato automation ones.

## Environment Variables

To run this project, create a `.env` file with the variables that are described in the `env.ts` file.
On top of that, you can edit network specific settings in `networkConfigs.ts` file.

## Running Tests

To run tests, run the following command

```bash
  yarn test
```

## Run Locally

Install dependencies

```bash
  yarn
```

Run local fork of polygon mainnet

```bash
  yarn hh:node
```

## Deployment

To deploy this project run

```bash
  npx hardhat deploy --network [network_name]
```
