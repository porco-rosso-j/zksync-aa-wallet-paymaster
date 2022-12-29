import { Wallet, Contract, Provider, utils, EIP712Signer, types } from "zksync-web3";
import { ethers } from "ethers";

export interface TxParams {
    provider: Provider,
    erc20: Contract, 
    account: Contract, 
    paymaster: Contract,
    wallet: Wallet,
    user1: Wallet,
    user2: Wallet,
    isApprovalBased: boolean,
    isBatched: boolean,
    txData: any // or Bytes[], String[]?
  }

  // Send transaction from Account Abstraction via Paymaster
  export async function sendAATxViaPaymaster(txParams:TxParams) {
    
    const paymasterParams = await makePaymasterParams(txParams);

    let tx = {
        ...txParams.txData,
        from: txParams.account.address,
        chainId: (await txParams.provider.getNetwork()).chainId,
        nonce: await txParams.provider.getTransactionCount(txParams.account.address),
        type: 113,
        customData: {
            paymasterParams,
            ergsPerPubdata: utils.DEFAULT_ERGS_PER_PUBDATA_LIMIT,
        } as types.Eip712Meta,
        value: ethers.BigNumber.from(0),
        gasPrice: await txParams.provider.getGasPrice(),
        gasLimit: "0x00"
    };

    tx = await makeTxData(txParams, tx)
    tx = await signTx(txParams, tx)
  
     const sentTx = await txParams.provider.sendTransaction(utils.serialize(tx));
     await sentTx.wait();

  }

  // Construct PaymasterParams
   async function makePaymasterParams(txParams:TxParams) {
    let paymasterParams;

    const token_price = await txParams.paymaster.getETHPerToken(txParams.erc20.address)
    const AbiCoder = new ethers.utils.AbiCoder()
    const input = AbiCoder.encode(["uint"], [token_price])

    if (txParams.isApprovalBased) {
        paymasterParams = utils.getPaymasterParams(txParams.paymaster.address, {
            type: "ApprovalBased",
            token: txParams.erc20.address,
            minimalAllowance: (await txParams.paymaster.tokens(txParams.erc20.address)).minFee,
            innerInput: input,
           });       
        return paymasterParams
    } else {
        paymasterParams = utils.getPaymasterParams(txParams.paymaster.address, {
            type: "General",
            innerInput: new Uint8Array,
        });
    }
    return paymasterParams
   }

   // Construct Transaction Data depending on whether batched or not
   async function makeTxData(txParams: TxParams, tx: any) {
    if (txParams.isBatched) {
        tx.to = txParams.account.address
        tx.data = txParams.txData
        tx.gasLimit = ethers.utils.hexlify(1000000)
    } else {
        tx.gasLimit = await txParams.provider.estimateGas(tx)
    }
    return tx;
    }

  // Sign Transaction 
   async function signTx(txParams:TxParams, tx: any) {

    const signedTxHash = EIP712Signer.getSignedDigest(tx);
    const signature = ethers.utils.concat([
        ethers.utils.joinSignature(txParams.user1._signingKey().signDigest(signedTxHash)),
        ethers.utils.joinSignature(txParams.user2._signingKey().signDigest(signedTxHash)),
    ])
  
    tx.customData = {
      ...tx.customData,
      customSignature: signature,
    };

    return tx;
  }