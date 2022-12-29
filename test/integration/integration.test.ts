import * as chai from "chai";
const expect = chai.expect;
import { solidity } from 'ethereum-waffle';
chai.use(solidity);

import { Wallet, Provider, Contract } from "zksync-web3";
import * as hre from "hardhat";
import { ethers } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
const rich_wallet = require('../../local-setup/rich-wallets');

import { TxParams, sendAATxViaPaymaster } from "./utils/sendtx"
import { toBN } from "./utils/number"
import {
    deployToken,
    deployPaymaster,
    deployMAFactory,
    deployAccount
} from "./utils/deploy"

const dev_pk = rich_wallet[0].privateKey
const dev2_pk = rich_wallet[1].privateKey
const dev3_pk = rich_wallet[2].privateKey

/* Test of All features below
Account-Abstraction, Paymaster and Batched Transaction

Work-Flow: 
1: Deployment: ERC20, Paymaster, MAFactory, Account
2: Setup: Send ETH and tokens to Paymaster and Account
3: Approve: Account should approve Paymaster ( gas cost sponsored by paymaster )
4: Transfers: Send a batched transaction that account send tokens to user1 and user2 ( gas cost paid in ERC20 by account )

Goal: Gasless and flexible onboarding and transaction
* User1 (an owner of the account) doesnt lose any ETH to deploy account
  - Deployment of the account for users is done by wallet which is the deployer of Factory Contract
* Account doesn't own ETH but can transact by ether being sponsored or only paying gas fees in ERC20
  - For approve, paymaster, not account, just pay gas fee in ETH.
  - For bathced tx, paymaster receives ERC20 in return for paying gas fee in ETH to the network.

*/

let provider: Provider
let wallet: Wallet
let user1: Wallet
let user2: Wallet
let deployer: Deployer

let erc20: Contract
let paymaster: Contract
let factory: Contract
let account: Contract

before(async () => {
  provider = Provider.getDefaultProvider();
  wallet = new Wallet(dev_pk, provider);
  user1 = new Wallet(dev2_pk, provider);
  user2 = new Wallet(dev3_pk, provider);
  deployer = new Deployer(hre, wallet);

  erc20 = await deployToken(deployer);
  paymaster = await deployPaymaster(deployer, erc20.address);
  factory = await deployMAFactory(deployer);
  account = await deployAccount(deployer, wallet, user1, user2, factory.address);
})

describe("Integration Test: Deployment & Set-up", function () {
  it("Deployment: Should deploy ERC20, Paymaster, Account correctly", async function () {

    await(await paymaster.setETHPerToken(toBN("0.0008"))).wait()
    await(await paymaster.setMinTokenFee(toBN("0.1"))).wait()

    expect(await erc20.name()).to.equal("MyERC20")
    expect(await erc20.decimals()).to.equal(18)

    expect(await paymaster.getETHPerToken()).to.eq(toBN("0.0008"))
    expect(await paymaster.minTokenFee()).to.eq(toBN("0.1"))
    expect(await paymaster.allowedToken()).to.eq(erc20.address)

    expect(await account.owner1()).to.equal(user1.address)
    expect(await account.owner2()).to.equal(user2.address)

    console.log(
        '\n',
        '-- Addresses -- ','\n',
        '- ERC20 Addr: ', erc20.address, '\n',
        '- Factory Addr: ', factory.address, '\n',
        '- Paymaster Addr: ', paymaster.address, '\n',
        '- Wallet Addr: ', wallet.address, '\n',
        '- Account Addr: ', account.address, '\n',
        '- User1 Addr: ', user1.address, '\n',
        '- User2 Addr: ', user2.address, '\n',
        '\n',
      )
  });

  it("Setup: Should transfer ETH & ERC20 correctly", async function(){

    // ETH to Paymaster
    await (await wallet.sendTransaction({
        to: paymaster.address,
        value: toBN("1")
    })).wait()

    // ERC20 to Account ( onramp )
    await (await erc20.mint(
        account.address, 
        toBN("100"))
    ).wait()

  })

  it("Approve: Account should approve paymaster sufficiently", async function() {

    // create tx instance
    const tx = await erc20.populateTransaction.approve(paymaster.address, toBN("1"))

    let txParams: TxParams = {
        provider,
        erc20, 
        account, 
        paymaster,
        wallet,
        user1,
        user2,
        isApprovalBased: false,
        isBatched: false,
        txData: tx
     }

    // send Tx from Account Abstraction Wallet via Paymaster
    await sendAATxViaPaymaster(txParams)

    const allowance = await erc20.allowance(account.address, paymaster.address);
    const minTokenFee = await paymaster.minTokenFee();
    expect(allowance).to.be.gt(minTokenFee)
  })

  it("Transfer: Account should batch-transfer&mint ERC20 to user1 and user2 via Paymaster", async function () {

    console.log("Before")
    const balBefore = await getBalances(provider, erc20, wallet, paymaster, account, user1, user2)

    let tx1 = await erc20.populateTransaction.transfer(user1.address, toBN("10"))
    let tx2 = await erc20.populateTransaction.transfer(user2.address, toBN("10"))
    let tx3 = await erc20.populateTransaction.mint(user1.address, toBN("15"))
    let tx4 = await erc20.populateTransaction.mint(user2.address, toBN("20"))

    const targets = [
        erc20.address,
        erc20.address, 
        erc20.address, 
        erc20.address
    ]

    const methods = [
        tx1.data, 
        tx2.data, 
        tx3.data, 
        tx4.data
    ]

    // Encode contract addresses and methods data for Multicall
    const AbiCoder = new ethers.utils.AbiCoder()
    const tx = AbiCoder.encode(["address[]", "bytes[]"], [targets, methods])

    let txParams: TxParams = {
        provider,
        erc20, 
        account, 
        paymaster,
        wallet,
        user1,
        user2,
        isApprovalBased: true,
        isBatched: true,
        txData:tx
     }

    // send Tx from Account Abstraction Wallet via Paymaster
    await sendAATxViaPaymaster(txParams)

    console.log("After")
    const balAfter = await getBalances(provider, erc20, wallet, paymaster, account, user1, user2)

    expect(balAfter.WalletETHBal).to.eq(balBefore.WalletETHBal)
    expect(balAfter.PaymasterETHBal).to.lt(balBefore.PaymasterETHBal)
    expect(balAfter.AccountETHBal).to.eq(balBefore.AccountETHBal)
    expect(balAfter.User1ETHBal).to.eq(balBefore.User1ETHBal)
    expect(balAfter.PaymasterTokenBal).to.gt(toBN("0.1"))
    expect(balAfter.AccountTokenBal).to.closeTo(toBN("80"), toBN("1"))
    expect(balAfter.User1TokenBal).to.eq(toBN("25"))
    expect(balAfter.User2TokenBal).to.eq(toBN("30"))
 })
});

async function getBalances(provider,erc20, wallet, paymaster, account, user1, user2) {

    const WalletETHBal = await provider.getBalance(wallet.address)
    const PaymasterETHBal = await provider.getBalance(paymaster.address)
    const AccountETHBal = await provider.getBalance(account.address)
    const User1ETHBal = await provider.getBalance(user1.address)
    const PaymasterTokenBal = await erc20.balanceOf(paymaster.address)
    const AccountTokenBal = await erc20.balanceOf(account.address)
    const User1TokenBal = await erc20.balanceOf(user1.address)
    const User2TokenBal = await erc20.balanceOf(user2.address)

    console.log(
        '\n',
        'Balances', '\n',
        '- Wallet ETH balance: ', WalletETHBal.toString(), '\n',
        '- Paymaster ETH balance: ', PaymasterETHBal.toString(), '\n',
        '- Account ETH balance: ', AccountETHBal.toString(), '\n',
        '- User1 ETH balance: ', User1ETHBal.toString(), '\n',
        '- Paymaster Token balance: ', PaymasterTokenBal.toString(), '\n',
        '- Account Token balance: ', AccountTokenBal.toString(), '\n',
        '- User1 Token balance: ',  User1TokenBal.toString(), '\n',
        '- User2 Token balance: ',  User2TokenBal.toString(), '\n',
        '\n',
      )

    const balances = {
        WalletETHBal, 
        PaymasterETHBal, 
        AccountETHBal, 
        User1ETHBal, 
        PaymasterTokenBal,
        AccountTokenBal, 
        User1TokenBal,
        User2TokenBal
    }

    return balances
    
}