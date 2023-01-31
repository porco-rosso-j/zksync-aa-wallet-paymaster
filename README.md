# Overview

An implementation of zkSync's account abstraction and paymaster with a batched transaction and daily spending limit feature. You can find and explore more details about zkSync and those features in the documentation below.

- [zkSync Developer Doc](https://v2-docs.zksync.io/dev/)
- [Account Abstraction](https://v2-docs.zksync.io/dev/developer-guides/aa.html#introduction)
- [Tutorial: Account Abstraction](https://v2-docs.zksync.io/dev/tutorials/custom-aa-tutorial.html)
- [Tutorial: Paymaster](https://v2-docs.zksync.io/dev/tutorials/custom-paymaster-tutorial.html)

## Developments

### Account
zkSync Account Abstraction contract wallet. Architecture is inspired by Gnosis Safe.

#### Batch transaction 
`Account.sol` has multicall feature so that it can facilitate batched transactions with `_executeBatchTransaction` where for-loop utilizes `targets[]` and `methods[]` data which respectively store contract addresses and functions. As such, in a batched transaction, msg.data isn't single hexlified method data but a batched multiple transaction data encoded with AbiCoder.encode() method. 

#### Sponsored Transaction
As zksync-unique `approvalBased` paymaster flow is supported, `MyPaymaster.sol` allows the account to both proceed gas-sponsored transcations and gas payments in ERC20. Also, it calculates the actual gas cost in ERC20 terms with the price data retrieved from chainlink oracle. 

#### Spending limit 
The daily-spending limit feature can be enabled for the account, where it refuses the account to spend in ETH/ERC20 more than a configured limit amount. 


*Currently, deployment and test in this repo are depreciated*

## Deployment & Test

```shell
git clone git@github.com:porco-rosso-j/zksync-aa-wallet-paymaster.git
```

- Enter the repo and install dependencies.

```shell
cd zksync-aa-wallet-paymaster
npm i
```

- To set-up local environment, Docker and docker-compose should be installed.    
  If they are not installed on your computer: [Install](https://docs.docker.com/get-docker/).  

- To run zkSync local chain, do:

```shell
git clone https://github.com/matter-labs/local-setup.git
cd local-setup
./start.sh
```

\*check details and common errors for running local zksync chain [here](https://v2-docs.zksync.io/api/hardhat/testing.html#reset-the-zksync-state).

- compile:

```shell
npm run compile
```

- additional configuration: add .env file `touch .env` and add `NODE_ENV=test` in it.

- deploy:

```shell
npx hardhat deploy-zksync --script deploy/<file-name>.ts
```

example:
```shell
npx hardhat deploy-zksync --script deploy/deploy-paymaster.ts
```

- test:

```shell
npm run test:integration
```
