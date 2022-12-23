import { expect } from "chai";
import { Wallet, Provider, Contract, utils, EIP712Signer, types } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers, BigNumber} from "ethers";
const rich_wallet = require('../local-setup/rich-wallets');

const dev_pk = rich_wallet[0].privateKey
const wallet2 = rich_wallet[1].address

const toBN = (x: string): BigNumber => {
  return ethers.utils.parseEther(x)
}

async function deployMAFactory(deployer: Deployer): Promise<Contract> {
  const factoryArtifact = await deployer.loadArtifact("MAFactory");
  const accountArtifact = await deployer.loadArtifact("MultiSigAccount");
  const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);

  return await deployer.deploy(factoryArtifact, [bytecodeHash], undefined, [accountArtifact.bytecode]);
  }

async function deployAccount(deployer: Deployer, wallet: Wallet, factory_address:string): Promise<Contract> {
  const factoryArtifact = await hre.artifacts.readArtifact("MAFactory");
  const factory = new ethers.Contract(factory_address, factoryArtifact.abi, wallet);

  owner1 = Wallet.createRandom();
  owner2 = Wallet.createRandom();
  salt = ethers.constants.HashZero;

  await(await factory.deployAccount(salt, owner1.address, owner2.address)).wait()

  const AbiCoder = new ethers.utils.AbiCoder();
  account_address = utils.create2Address(
      factory.address,
      await factory.maBytecodeHash(),
      salt,
      AbiCoder.encode(["address", "address"], [owner1.address, owner2.address])
  );

  const accountArtifact = await deployer.loadArtifact("MultiSigAccount");
  
  return new ethers.Contract(account_address, accountArtifact.abi, wallet)
}

async function deployAccountFromAcc(factory:Contract, account_address:string) {

  let maTx = await factory.populateTransaction.deployAccount(
    salt, 
    Wallet.createRandom().address, 
    Wallet.createRandom().address,
    );

  const gasLimit = await provider.estimateGas(maTx);
  const gasPrice = await provider.getGasPrice();

  maTx = {
      ...maTx,
      from: account_address,
      gasLimit: gasLimit,
      gasPrice: gasPrice,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(account_address),
      type: 113,
      customData: {
          ergsPerPubdata: utils.DEFAULT_ERGS_PER_PUBDATA_LIMIT,
      } as types.Eip712Meta,
      value: ethers.BigNumber.from(0),
  };

  const signedTxHash = EIP712Signer.getSignedDigest(maTx);
  const signature = ethers.utils.concat([
      ethers.utils.joinSignature(owner1._signingKey().signDigest(signedTxHash)),
      ethers.utils.joinSignature(owner2._signingKey().signDigest(signedTxHash)),
  ]);

  maTx.customData = {
    ...maTx.customData,
    customSignature: signature,
  };

   const sentTx = await provider.sendTransaction(utils.serialize(maTx));
   await sentTx.wait();
}

let provider
let wallet 
let deployer
let factory
let account
let account_address

let owner1
let owner2
let salt

before(async () => {
  provider = Provider.getDefaultProvider();
  wallet = new Wallet(dev_pk, provider);
  deployer = new Deployer(hre, wallet);

  factory = await deployMAFactory(deployer);
  account = await deployAccount(deployer, wallet, factory.address);

  await (
    await wallet.sendTransaction({
        to: account_address,
        value: toBN("1")
    })
  ).wait();

  await deployAccountFromAcc(factory, account_address)

})

describe("Account Test: Deployment & Set-up", function () {
  it("Should deploy Factory & Account correctly", async function () {

    const accountArtifact = await deployer.loadArtifact("MultiSigAccount");
    account = new ethers.Contract(account_address, accountArtifact.abi, wallet)

    expect(await account.owner1()).to.equal(owner1.address)
    expect(await account.owner2()).to.equal(owner2.address)

    console.log(
        '\n',
        '- Wallet Addr: ', wallet.address, '\n',
        '- Factory Addr: ', factory.address, '\n',
        '- Account Addr: ', account.address, '\n',
        '- Wallet ETH balance: ', (await provider.getBalance(wallet.address)).toString(), '\n',
        '- account ETH balance: ', (await provider.getBalance(account.address)).toString(), '\n',
        '- Done :', '\n',
        '\n',
      )
  });
});
