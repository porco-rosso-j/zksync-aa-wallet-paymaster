import { Wallet, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { BigNumber, ethers } from "ethers";

export async function deployToken(deployer: Deployer): Promise<Contract> {
    const artifact = await deployer.loadArtifact("MyERC20");
    return await deployer.deploy(artifact, ["MyERC20", "MyERC20", 18]);
  }

export async function deployPaymaster(deployer: Deployer): Promise<Contract> {
  const artifact = await deployer.loadArtifact("MyPaymaster");
  return await deployer.deploy(artifact);
}

export async function deployV3Aggregator(deployer: Deployer, decimals:number, price:BigNumber): Promise<Contract> {
  const artifact = await deployer.loadArtifact("MockV3Aggregator");
  return await deployer.deploy(artifact, [decimals, price]);
}

export async function deployMAFactory(deployer: Deployer): Promise<Contract> {
    const factoryArtifact = await deployer.loadArtifact("MAFactory");
    const accountArtifact = await deployer.loadArtifact("MultiSigAccount");
    const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);
  
    return await deployer.deploy(factoryArtifact, [bytecodeHash], undefined, [accountArtifact.bytecode]);
    }

export async function deploySpendingManager(deployer: Deployer): Promise<Contract> {
  const artifact = await deployer.loadArtifact("SpendingManager");
  return await deployer.deploy(artifact);
}

export async function deployAccount(deployer: Deployer, wallet: Wallet, owner1: Wallet, owner2: Wallet, factory_address:string, sm_address:string): Promise<Contract> {
    const factoryArtifact = await hre.artifacts.readArtifact("MAFactory");
    const factory = new ethers.Contract(factory_address, factoryArtifact.abi, wallet);
  
    const salt = ethers.constants.HashZero;
    await(await factory.deployAccount(salt, owner1.address, owner2.address, sm_address)).wait()
  
    const AbiCoder = new ethers.utils.AbiCoder();
    const account_address = utils.create2Address(
        factory.address,
        await factory.maBytecodeHash(),
        salt,
        AbiCoder.encode(["address", "address", "address"], [owner1.address, owner2.address, sm_address])
    );
  
    const accountArtifact = await deployer.loadArtifact("MultiSigAccount");
    
    return new ethers.Contract(account_address, accountArtifact.abi, wallet)
  }

