import { utils, Wallet, Provider, EIP712Signer, types } from "zksync-web3";
import * as ethers from "ethers";
import * as hre from "hardhat";
const rich_wallet = require('../local-setup/rich-wallets');
const dev_pk = rich_wallet[0].privateKey

const MAFactory_Address = ""

export default async function () {
    const provider = Provider.getDefaultProvider();
    const wallet = new Wallet(dev_pk).connect(provider);
    const factoryArtifact = await hre.artifacts.readArtifact("MAFactory");

    const maFactory = new ethers.Contract(MAFactory_Address, factoryArtifact.abi, wallet);

    const owner1 = Wallet.createRandom();
    const owner2 = Wallet.createRandom();

    const salt = ethers.constants.HashZero;

    const tx = await maFactory.deployAccount(salt, owner1.address, owner2.address);
    tx.wait();

    const AbiCoder = new ethers.utils.AbiCoder();
    const multisigAddress = utils.create2Address(
        MAFactory_Address,
        await maFactory.maBytecodeHash(),
        salt,
        AbiCoder.encode(["address", "address"], [owner1.address, owner2.address])
    );
    console.log("Deployed on address: ", multisigAddress);

    await (
        await wallet.sendTransaction({
            to: multisigAddress,
            value: ethers.utils.parseEther("0.001")
        })
    ).wait();

    let maTx = await maFactory.populateTransaction.deployAccount(
        salt, 
        Wallet.createRandom().address, 
        Wallet.createRandom().address,
        );

    const gasLimit = await provider.estimateGas(maTx);
    const gasPrice = await provider.getGasPrice();

    maTx = {
        ...maTx,
        from: multisigAddress,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        chainId: (await provider.getNetwork()).chainId,
        nonce: await provider.getTransactionCount(multisigAddress),
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

    console.log("The multisig's nocne before the second tx is: ", await provider.getTransactionCount(multisigAddress));
    const sentTx = await provider.sendTransaction(utils.serialize(maTx));
    await sentTx.wait();

    console.log("The multisig's nonce after the second tx is: ", await provider.getTransactionCount(multisigAddress));

}