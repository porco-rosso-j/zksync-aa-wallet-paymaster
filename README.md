# zksync-aa-wallet
Implementation of account abstraction wallet on zksync


- [zkSync Developer Doc](https://v2-docs.zksync.io/dev/). 
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
[check details and common errors](https://v2-docs.zksync.io/api/hardhat/testing.html#reset-the-zksync-state)

