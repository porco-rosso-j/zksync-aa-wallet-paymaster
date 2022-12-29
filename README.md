# Overview
Implementation of example codes of zkSync's account abstraction and paymaster with batched transaction features. You can find and explore more details in zkSync documentation below.

- [zkSync Developer Doc](https://v2-docs.zksync.io/dev/)
- [Tutorial: Account Abstraction](https://v2-docs.zksync.io/dev/tutorials/custom-aa-tutorial.html)
- [Tutorial: Paymaster](https://v2-docs.zksync.io/dev/tutorials/custom-paymaster-tutorial.html)

Only difference in implementation between `MultiSigAccount.sol` and the corresponding one in tutorial is whether or not it can facilitate batched transaction in `_executeBatchTransaction`. 

Paymaster is also not different from the example but it calculates the actual gas cost in ERC20 term and makes the tx initiator(EOA or aa-wallet) transfer the ERC20 token to Paymaster in exchange for paying gas in ETH to the network, in order for the initiator to be able to pay nothing or gas fee in any preferable ERC20 token.  

# Deployment & Test

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
*check details and common errors for running local zksync chain [here](https://v2-docs.zksync.io/api/hardhat/testing.html#reset-the-zksync-state). 

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
npm run test:unit // or
npm run test:integration
```
