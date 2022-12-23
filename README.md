# zksync-aa-wallet-paymaseter
Implementation of example codes of account abstraction and paymaster features on zksync. You can find and explore more details in zkSync documentation below.

Only `Paymaster.sol`'s code is differnet from the sample code in tutorials. Especially, Paymaster calculates the actual gas cost in ERC20 term and makes the tx initiator(EOA or aa-wallet) transfer the ERC20 token to Paymaster in exchange for paying gas in ETH to the network, in order for the initiator to be able to pay gas fee in any preferable ERC20 token.  

Plus, test file `test_all.test.ts` combines the tests of `MAFactory`, `MultiSigAccount` and `Paymaster` in a way that Paymaster pays gas fees for the transaction where a newly-deployed multi-sig account transfers ERC20 token to another wallet in return for receiving the ERC20 token from the account.

- [zkSync Developer Doc](https://v2-docs.zksync.io/dev/)
- [Tutorial: Account Abstraction](https://v2-docs.zksync.io/dev/tutorials/custom-aa-tutorial.html)
- [Tutorial: Paymaster](https://v2-docs.zksync.io/dev/tutorials/custom-paymaster-tutorial.html)

## Deployment & Test

```shell
git clone git@github.com:porco-rosso-j/zksync-aa-wallet-paymaster.git
```

Enter the repo and install dependencies.
```shell
cd zksync-aa-wallet-paymaster
npm i
```
To set-up local environment, Docker and docker-compose should be installed.  
If they are not installed on your computer: [Install](https://docs.docker.com/get-docker/).

To run zkSync local chain, do:
```shell
git clone https://github.com/matter-labs/local-setup.git
cd local-setup
./start.sh
```
[*check details and common errors for running local zksync chain](https://v2-docs.zksync.io/api/hardhat/testing.html#reset-the-zksync-state).  

compile: 
```shell
npm run compile
```

deploy:
```shell
npx hardhat deploy-zksync --script deploy/deploy-paymaster.ts
```

test:
```shell
npm run test
```









