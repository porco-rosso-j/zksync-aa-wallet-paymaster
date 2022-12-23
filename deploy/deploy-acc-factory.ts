import { utils, Wallet } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as hre from "hardhat";
const rich_wallet = require('../local-setup/rich-wallets');
const dev_pk = rich_wallet[0].privateKey

export default async function () {
    const wallet = new Wallet(dev_pk);
    const deployer = new Deployer(hre, wallet);

    const factoryArtifact = await deployer.loadArtifact("MAFactory");
    const maArtifact = await deployer.loadArtifact("MultiSigAccount");

    const bytecodeHash = utils.hashBytecode(maArtifact.bytecode);
    const factory = await deployer.deploy(factoryArtifact, [bytecodeHash], undefined, [maArtifact.bytecode]);
    console.log("MA Factory address: ", factory.address);

}