import { HardhatUserConfig } from 'hardhat/config';
require('dotenv').config();
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");

const zkSyncTestnet =
  process.env.NODE_ENV == "test"
    ? {
        url: "http://localhost:3050",
        ethNetwork: "http://localhost:8545",
        zksync: true,
      }
    : {
        url: "https://zksync2-testnet.zksync.dev",
        ethNetwork: process.env.alchemy_api_goerli,
        zksync: true,
      };

const config:HardhatUserConfig = {
  zksolc: {
    version: '1.2.1',
    compilerSource: 'binary',
    settings: {},
  },

  defaultNetwork: "zkSyncTestnet",

  networks: {
    hardhat: {
        // @ts-ignore
        zksync: true
    },
    zkSyncTestnet,
  },
  solidity: {
      version: "0.8.16",
  },
};

export default config;