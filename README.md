# Overview


Implementation of example codes of zkSync's account abstraction and paymaster with a batched transaction feature. You can find and explore more details about zkSync and those features in the documentation below.

- [zkSync Developer Doc](https://v2-docs.zksync.io/dev/)
- [Account Abstraction](https://v2-docs.zksync.io/dev/developer-guides/aa.html#introduction)
- [Tutorial: Account Abstraction](https://v2-docs.zksync.io/dev/tutorials/custom-aa-tutorial.html)
- [Tutorial: Paymaster](https://v2-docs.zksync.io/dev/tutorials/custom-paymaster-tutorial.html)

## Developments

The belows are the description of the notable improvements which make this implementation differ from example codes in the tutorial.

### MultiSigAccount

`MultiSigAccount.sol` has multicall feature so that it can facilitate batched transactions with `_executeBatchTransaction` where for-loop utilizes `targets[]` and `methods[]` data which respectively store contract addresses and functions. As such, in a batched transaction, msg.data isn't single hexlified method data but a batched multiple transaction data encoded with AbiCoder.encode() method. 

Plus, `prePaymaster()` supports `approvalBased` paymaster flow in order for accounts to not have to send a separate tx to approve paymaster before any transaction that requires it to pay in ERC20 token.

### MyPaymaster

Accounts are able to pay nothing or gas fee in any preferable ERC20 token by asking Paymaster paying gas fee in ETH to the network. Unlike tutorial example, `MyPaymaster.sol` in this implementation supports multiple ERC20 tokens for sponsored transations, and also it calculates the actual gas cost in ERC20 terms with the price data retrieved from chainlink oracle. 

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
