import * as chai from "chai";
const expect = chai.expect;
import { solidity } from 'ethereum-waffle';
chai.use(solidity);

import { Wallet, Provider } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
const rich_wallet = require('../local-setup/rich-wallets');

import {
  toBN,
  deployToken,
  deployPaymaster,
  deployMAFactory,
  deployAccount,
  sendAATxViaPaymaster
} from "./test-functions"

const dev_pk = rich_wallet[0].privateKey
const dev2_pk = rich_wallet[1].privateKey

let provider
let wallet 
let wallet2
let deployer

let erc20
let paymaster
let factory
let account

before(async () => {
  provider = Provider.getDefaultProvider();
  wallet = new Wallet(dev_pk, provider);
  wallet2 = new Wallet(dev2_pk, provider);
  deployer = new Deployer(hre, wallet);

  erc20 = await deployToken(deployer);
  paymaster = await deployPaymaster(deployer, erc20.address);
  factory = await deployMAFactory(deployer);
  account = await deployAccount(deployer, wallet, wallet2, factory.address);
})

describe("Integration Test: Deployment & Set-up", function () {
  it("Deployment: Should deploy ERC20, Paymaster, Account correctly", async function () {

    await(await paymaster.setETHPerToken(toBN("0.00083"))).wait()
    await(await paymaster.setMinTokenFee(toBN("0.1"))).wait()

    expect(await erc20.name()).to.equal("MyERC20")
    expect(await erc20.decimals()).to.equal(18)

    expect(await paymaster.getETHPerToken()).to.eq(toBN("0.00083"))
    expect(await paymaster.minTokenFee()).to.eq(toBN("0.1"))
    expect(await paymaster.allowedToken()).to.eq(erc20.address)

    expect(await account.owner1()).to.equal(wallet.address)
    expect(await account.owner2()).to.equal(wallet2.address)

    console.log(
        '\n',
        '-- Addresses -- ','\n',
        '- Wallet Addr: ', wallet.address, '\n',
        '- Factory Addr: ', factory.address, '\n',
        '- Account Addr: ', account.address, '\n',
        '- Paymaster Addr: ', paymaster.address, '\n',
        '\n',
      )
  });

  it("Setup: Should transfered eth&tokens correctly", async function(){

    await (await wallet.sendTransaction({
        to: paymaster.address,
        value: toBN("1")
    })).wait()

    await (await wallet.sendTransaction({
        to: account.address,
        value: toBN("1")
    })).wait()

    await (await erc20.mint(
        account.address, 
        toBN("100"))
    ).wait()

    console.log(
        '\n',
        '-- Initial Balances -- ','\n',
        '- Wallet ETH balance: ', (await provider.getBalance(wallet.address)).toString(), '\n',
        '- Paymaster ETH balance: ', (await provider.getBalance(paymaster.address)).toString(), '\n',
        '- Account ETH balance: ', (await provider.getBalance(account.address)).toString(), '\n',
        '- Paymaster Token balance: ', (await erc20.balanceOf(paymaster.address)).toString(), '\n',
        '- Account Token balance: ', (await erc20.balanceOf(account.address)).toString(), '\n',
        '- Wallet2 Token balance: ',  (await erc20.balanceOf(wallet2.address)).toString(), '\n',
        '\n',
      )

  })

  it("Approve: Should Account approves paymaster sufficiently", async function() {

    //await (await erc20.approve(account.address, toBN("100")))
    // create tx instance
    const tx = await erc20.populateTransaction.approve(paymaster.address, toBN("10"))

    // send Tx from Account Abstraction Wallet via Paymaster
    await sendAATxViaPaymaster(
        provider,
        erc20,
        tx,
        account,
        paymaster,
        wallet,
        wallet2
    )

    const allowance = await erc20.allowance(account.address, paymaster.address);
    const minTokenFee = await paymaster.minTokenFee();
    expect(allowance).to.be.gt(minTokenFee)
    console.log(
        '\n',
        '-- Approval -- ','\n',
        '- Accoount allowance to PM: ',  allowance.toString(), '\n',
        '\n',
      )
  })

  it("Transfer: Should transfer Token from AA wallet to wallet2 via Paymaster", async function () {
    const AccountETHBalBefore = await provider.getBalance(account.address)
    const WalletETHBalBefore = await provider.getBalance(wallet.address)

    // create tx instance
    const tx = await erc20.populateTransaction.transfer(wallet2.address, toBN("15"))

    // send Tx from Account Abstraction Wallet via Paymaster
    await sendAATxViaPaymaster(
        provider,
        erc20,
        tx,
        account,
        paymaster,
        wallet,
        wallet2
    )

    const WalletETHBal = await provider.getBalance(wallet.address)
    const PaymasterETHBal = await provider.getBalance(paymaster.address)
    const AccountETHBal = await provider.getBalance(account.address)
    const PaymasterTokenBal = await erc20.balanceOf(paymaster.address)
    const AccountTokenBal = await erc20.balanceOf(account.address)
    const Wallet2TokenBal = await erc20.balanceOf(wallet2.address)

    expect(WalletETHBal).to.eq(WalletETHBalBefore)
    expect(PaymasterETHBal).to.lt(toBN("1"))
    expect(AccountETHBal).to.eq(AccountETHBalBefore)
    expect(PaymasterTokenBal).to.gt(toBN("0.1"))
    expect(AccountTokenBal).to.closeTo(toBN("85"), toBN("1"))
    expect(Wallet2TokenBal).to.eq(toBN("15"))

    console.log(
        '\n',
        'After ERC20 Transfer from Account to Wallet2 via Paymaster', '\n',
        '- Wallet ETH balance: ', WalletETHBal.toString(), '\n',
        '- Paymaster ETH balance: ', PaymasterETHBal.toString(), '\n',
        '- Account ETH balance: ', AccountETHBal.toString(), '\n',
        '- Paymaster Token balance: ', PaymasterTokenBal.toString(), '\n',
        '- Account Token balance: ', AccountTokenBal.toString(), '\n',
        '- Wallet2 Token balance: ',  Wallet2TokenBal.toString(), '\n',
        '- Done', '\n',
        '\n',
      )

 })
});
