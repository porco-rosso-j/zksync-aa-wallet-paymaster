import { Wallet } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers } from "ethers";
import * as hre from "hardhat";
const rich_wallet = require('../local-setup/rich-wallets');
const dev_pk = rich_wallet[0].privateKey

export default async function () {
    const wallet = new Wallet(dev_pk)

    const emptyWallet = Wallet.createRandom()
    console.log("Empty wallet's address: ", emptyWallet.address)
    console.log("Empty wallet's private key: ", emptyWallet.privateKey);
    
    const deployer = new Deployer(hre, wallet)

    const erc20Artifact = await deployer.loadArtifact("MyERC20");
    const erc20 = await deployer.deploy(erc20Artifact, ["MyERC20", "MyERC20", 18]);
    console.log(`ERC20 address: ${erc20.address}`);

    const payMasterArtifact = await deployer.loadArtifact("Paymaster")
    const myPaymaster = await deployer.deploy(payMasterArtifact, [erc20.address])
    console.log(`MyPaymaster address: ${myPaymaster.address}`);

    await(
        await deployer.zkWallet.sendTransaction({
            to: myPaymaster.address,
            value: ethers.utils.parseEther("0.01")
        })
    ).wait()

    await(await erc20.mint(emptyWallet.address, 100)).wait();

    console.log("Minted 100 tokens for the empty wallet :", (await erc20.balanceOf(emptyWallet.address)).toString());
    console.log("Done");
    
}