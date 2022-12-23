import { Wallet, Contract, Provider, utils, EIP712Signer, types } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers, BigNumber} from "ethers";

export const toBN = (x: string): BigNumber => {
    return ethers.utils.parseEther(x)
}

export async function deployToken(deployer: Deployer): Promise<Contract> {
    const artifact = await deployer.loadArtifact("MyERC20");
    return await deployer.deploy(artifact, ["MyERC20", "MyERC20", 18]);
  }

  export async function deployPaymaster(deployer: Deployer, erc20address: string): Promise<Contract> {
  const artifact = await deployer.loadArtifact("Paymaster");
  return await deployer.deploy(artifact, [erc20address]);
}

export async function deployMAFactory(deployer: Deployer): Promise<Contract> {
    const factoryArtifact = await deployer.loadArtifact("MAFactory");
    const accountArtifact = await deployer.loadArtifact("MultiSigAccount");
    const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);
  
    return await deployer.deploy(factoryArtifact, [bytecodeHash], undefined, [accountArtifact.bytecode]);
    }

export async function deployAccount(deployer: Deployer, wallet: Wallet, wallet2: Wallet, factory_address:string): Promise<Contract> {
    const factoryArtifact = await hre.artifacts.readArtifact("MAFactory");
    const factory = new ethers.Contract(factory_address, factoryArtifact.abi, wallet);
  
    const salt = ethers.constants.HashZero;
    await(await factory.deployAccount(salt, wallet.address, wallet2.address)).wait()
  
    const AbiCoder = new ethers.utils.AbiCoder();
    const account_address = utils.create2Address(
        factory.address,
        await factory.maBytecodeHash(),
        salt,
        AbiCoder.encode(["address", "address"], [wallet.address, wallet2.address])
    );
  
    const accountArtifact = await deployer.loadArtifact("MultiSigAccount");
    
    return new ethers.Contract(account_address, accountArtifact.abi, wallet)
  }

export async function sendAATxViaPaymaster(
    provider:Provider, 
    erc20:Contract, 
    tx:any, 
    acccount:Contract, 
    paymaster:Contract,
    wallet:Wallet,
    wallet2:Wallet
    ) {

    tx.customData = {
            ergsPerPubdata: utils.DEFAULT_ERGS_PER_PUBDATA_LIMIT,
            paymasterParams: {
                paymaster: paymaster.address,
                paymasterInput: "0x"
        }
    }
   
    const paymasterParams = utils.getPaymasterParams(paymaster.address, {
      type: "ApprovalBased",
      token: erc20.address,
      minimalAllowance: toBN("0.1"),
      innerInput: new Uint8Array()
  });
  
    tx = {
        ...tx,
        from: acccount.address,
        chainId: (await provider.getNetwork()).chainId,
        nonce: await provider.getTransactionCount(acccount.address),
        type: 113,
        customData: {
            paymasterParams,
            ergsPerPubdata: utils.DEFAULT_ERGS_PER_PUBDATA_LIMIT,
        } as types.Eip712Meta,
        value: ethers.BigNumber.from(0),
    };

    tx.gasPrice = await provider.getGasPrice();
    tx.gasLimit = await provider.estimateGas(tx);
  
    const signedTxHash = EIP712Signer.getSignedDigest(tx);
    const signature = ethers.utils.concat([
        ethers.utils.joinSignature(wallet._signingKey().signDigest(signedTxHash)),
        ethers.utils.joinSignature(wallet2._signingKey().signDigest(signedTxHash)),
    ]);
  

    tx.customData = {
      ...tx.customData,
      customSignature: signature,
    };


  
     const sentTx = await provider.sendTransaction(utils.serialize(tx));
     await sentTx.wait();
  }