import * as chai from "chai";
const expect = chai.expect;
import { solidity } from 'ethereum-waffle';
chai.use(solidity);

import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { ethers, BigNumber } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
const rich_wallet = require('../../local-setup/rich-wallets');

const ETH_ADDRESS = "0x000000000000000000000000000000000000800A"

import { toBN } from "./utils/number"
import {
    deployToken,
    deployPaymaster,
    deployV3Aggregator,
    deploySpendingManager,
    deployMAFactory,
    deployAccount
} from "./utils/deploy"
import { TxParams, sendAATxViaPaymaster } from "./utils/sendtx"
import { sleep } from "zksync-web3/build/src/utils";

const dev_pk = rich_wallet[0].privateKey
const dev2_pk = rich_wallet[1].privateKey
const dev3_pk = rich_wallet[2].privateKey

let provider: Provider
let wallet: Wallet
let user1: Wallet
let user2: Wallet
let deployer: Deployer

let erc20: Contract
let paymaster: Contract
let pricefeed: Contract
let spendingManager: Contract
let factory: Contract
let account: Contract

before(async () => {
    provider = Provider.getDefaultProvider();
    wallet = new Wallet(dev_pk, provider);
    user1 = new Wallet(dev2_pk, provider);
    user2 = new Wallet(dev3_pk, provider);
    deployer = new Deployer(hre, wallet);
  
    erc20 = await deployToken(deployer);
    paymaster = await deployPaymaster(deployer);
    pricefeed = await deployV3Aggregator(deployer, 18, toBN("0.0008"));
    spendingManager = await deploySpendingManager(deployer);
  
    factory = await deployMAFactory(deployer);
    account = await deployAccount(deployer, wallet, user1, user2, factory.address, spendingManager.address);
  
      // Add Token to Paymasters
      await(
          await paymaster.addToken(
              erc20.address, 
              toBN("0.1"), 
              true, 
              pricefeed.address)
      ).wait()
  
      // 1 ETH transfered to Paymaster
      await (
          await wallet.sendTransaction({
          to: paymaster.address,
          value: toBN("1")
      })
      ).wait()
  
      // 100 ETH transfered to Account
      await (
          await wallet.sendTransaction({
          to: account.address,
          value: toBN("100")
      })
      ).wait()

      // 100 ERC20 minted to Account ( onramp )
      await (await erc20.mint(
          account.address, 
          toBN("100"))
      ).wait()

      // Modify DailyLimit from 24horus to 15 seconds for the sake of testing.
      await(
        await spendingManager.setDailyLimit(15)
      ).wait()
  
  })
  
  describe.skip("Deployment & Setup", function () {

    it("Deployment: Should deploy ERC20, Paymaster, Account, Spending Manager correctly", async function () {
  
      expect(await erc20.name()).to.equal("MyERC20")
      expect(await erc20.decimals()).to.equal(18)
  
      expect(await paymaster.owner()).to.equal(wallet.address)
  
      expect(await pricefeed.decimals()).to.equal(18)
      expect(await pricefeed.latestAnswer()).to.equal(toBN("0.0008"))
  
      expect(await account.owner1()).to.equal(user1.address)
      expect(await account.owner2()).to.equal(user2.address)
      expect(await account.spendingManager()).to.equal(spendingManager.address)

      await consoleAddreses()
  
    });
  
    it("Setup: Should configure token variables in Paymaster and allocate ETH & ERC20 correctly", async function(){
  
      const tokenInfo = await paymaster.tokens(erc20.address)
      expect(tokenInfo.minFee).to.eq(toBN("0.1"))
      expect(tokenInfo.sponsored).to.eq(true)
      expect(tokenInfo.pricefeed).to.eq(pricefeed.address)
  
      expect(await provider.getBalance(paymaster.address)).to.eq(toBN("1"))
      expect(await provider.getBalance(account.address)).to.eq(toBN("100"))
      expect(await erc20.balanceOf(account.address)).to.eq(toBN("100"))
  
    })

  })

  describe("Spending Limit Test: ETH ", function () {

    it("Set SpendingLimit: Should add ETH spendinglimit to account correctly", async function(){

        let tx = await spendingManager.populateTransaction.setSpendingLimit(account.address, ETH_ADDRESS, toBN("10"));
        tx.value = ethers.utils.parseEther("0")
        let txParams = await getParams(true, false, tx)
    
        // send Tx from Account Abstraction Wallet via Paymaster
        const txReceipt = await sendAATxViaPaymaster(txParams)
        await txReceipt.wait()

        const limit = await spendingManager.getLimit(account.address, ETH_ADDRESS)
        expect(limit.limit).to.eq(toBN("10"))
        expect(limit.spent).to.eq(toBN("0"))
        expect(limit.resetTime.toNumber()).to.closeTo(Math.floor(Date.now() / 1000), 5)
        expect(limit.isActive).to.eq(true)

        await consoleLimit(limit)

    })

  it("Transfer ETH 1: Should transfer correctly", async function() {
    const balances = await getBalances()

    let tx = {
      data: "0x",
      from: account.address,
      to: user1.address,
      value: ethers.utils.parseEther("5")
    }

    let txParams = await getParams(true, false, tx)

    // send Tx from Account Abstraction Wallet via Paymaster
    const txReceipt = await sendAATxViaPaymaster(txParams)
    await txReceipt.wait()

    expect((await provider.getBalance(user1.address))).to.eq((balances.User1ETHBal.add(toBN("5"))))
    expect((await provider.getBalance(account.address))).to.eq(balances.AccountETHBal.sub(toBN("5")))

    const limit = await spendingManager.getLimit(account.address, ETH_ADDRESS)
    expect(limit.limit).to.eq(toBN("10"))
    expect(limit.spent).to.eq(toBN("5"))
    expect(limit.resetTime.toNumber()).to.lt(Math.floor(Date.now() / 1000))
    expect(limit.isActive).to.eq(true)

    await consoleLimit(limit)

    await getBalances()

  })

  it("Transfer ETH 2: Should revert due to spending limit", async function() {
    if (true) return this.skip();
    const balances = await getBalances()

    let tx = {
      data: "0x",
      from: account.address,
      to: user1.address,
      value: ethers.utils.parseEther("6")
    }

    let txParams = await getParams(true, false, tx)

    // send Tx from Account Abstraction Wallet via Paymaster
    const txReceipt = await sendAATxViaPaymaster(txParams)
    await expect(txReceipt.wait()).to.be.reverted

    expect((await provider.getBalance(account.address))).to.eq(balances.AccountETHBal)
    expect((await provider.getBalance(user1.address))).to.eq(balances.User1ETHBal)

    const limit = await spendingManager.getLimit(account.address, ETH_ADDRESS)
    expect(limit.limit).to.eq(toBN("10"))
    expect(limit.spent).to.eq(toBN("5"))
    expect(limit.resetTime.toNumber()).to.lt(Math.floor(Date.now() / 1000))
    expect(limit.isActive).to.eq(true)

    await consoleLimit(limit)

    await getBalances()

  })


  it("Transfer ETH 3: Should revert first but succeed after the daily limit resets", async function() {

    const balances = await getBalances()

    let tx = {
      data: "0x",
      from: account.address,
      to: user1.address,
      value: ethers.utils.parseEther("6")
    }

    let txParams = await getParams(true, false, tx)

    const resetTime = ((await spendingManager.getLimit(account.address, ETH_ADDRESS)).resetTime).toNumber()

    if (Math.floor(Date.now()/ 1000) <= resetTime + 15) { // before 15 seconds has passed
      const txReceipt = await sendAATxViaPaymaster(txParams)
      await expect(txReceipt.wait()).to.be.reverted
    }

    await sleep(15000); 

    if (Math.floor(Date.now()/ 1000) >= resetTime + 15) { // after 15 seconds has passed
        const txReceipt = await sendAATxViaPaymaster(txParams)
        await txReceipt.wait()
    }

      expect((await provider.getBalance(user1.address))).to.eq((balances.User1ETHBal.add(toBN("6"))))
      expect((await provider.getBalance(account.address))).to.eq(balances.AccountETHBal.sub(toBN("6")))
  
      const limit = await spendingManager.getLimit(account.address, ETH_ADDRESS)
      expect(limit.limit).to.eq(toBN("10"))
      expect(limit.spent).to.eq(toBN("6"))
      expect(limit.resetTime.toNumber()).to.gt(resetTime)
      expect(limit.isActive).to.eq(true)
  
      console.log(
        '\n',
        '"Limit"', '\n',
        '- Limit: ', limit.limit.toString(), '\n',
        '- Spent: ', limit.spent.toString(), '\n',
        '- Reset Time: ', limit.resetTime.toString(), '\n',
        '- Now: ', (Math.floor(Date.now() / 1000)).toString(), '\n',
        '- isActive: ', limit.isActive.toString(), '\n',
        '\n',
      )
  
      await getBalances()
  })

})

  describe("Spending Limit Test: ERC20 ", function () {

    it("Set SpendingLimit: Should add ERC20 spendinglimit to account correctly", async function(){

      let tx = await spendingManager.populateTransaction.setSpendingLimit(account.address, erc20.address, toBN("15"));
      tx.value = ethers.utils.parseEther("0")
      let txParams = await getParams(true, false, tx)
  
      // send Tx from Account Abstraction Wallet via Paymaster
      const txReceipt = await sendAATxViaPaymaster(txParams)
      await txReceipt.wait()

      const limit = await spendingManager.getLimit(account.address, erc20.address)
      expect(limit.limit).to.eq(toBN("15"))
      expect(limit.spent).to.eq(toBN("0"))
      expect(limit.resetTime.toNumber()).to.closeTo(Math.floor(Date.now() / 1000), 5)
      expect(limit.isActive).to.eq(true)

      await consoleLimit(limit)
  })

  it("Transfer ERC20 1: Should transfer correctly", async function() {

    const balances = await getBalances()

    let tx = await erc20.populateTransaction.transfer(user1.address, toBN("10"));
    tx.value = ethers.utils.parseEther("0")
    let txParams = await getParams(false, false, tx)

    // send Tx from Account Abstraction Wallet via Paymaster
    const txReceipt = await sendAATxViaPaymaster(txParams)
    await txReceipt.wait()

    expect((await erc20.balanceOf(user1.address))).to.eq((balances.User1TokenBal.add(toBN("10"))))
    expect((await erc20.balanceOf(account.address))).to.eq(balances.AccountTokenBal.sub(toBN("10")))

    const limit = await spendingManager.getLimit(account.address, erc20.address)
    expect(limit.limit).to.eq(toBN("15"))
    expect(limit.spent).to.eq(toBN("10"))
    expect(limit.resetTime.toNumber()).to.lt(Math.floor(Date.now() / 1000))
    expect(limit.isActive).to.eq(true)

    await consoleLimit(limit)

    await getBalances()

  })

  it("Transfer ERC20 2: Should revert due to spending limit", async function() {
    if (true) return this.skip();
    const balances = await getBalances()

    let tx = await erc20.populateTransaction.transfer(user1.address, toBN("14"));
    tx.value = ethers.utils.parseEther("0")
    let txParams = await getParams(false, false, tx)

    // send Tx from Account Abstraction Wallet via Paymaster
    const txReceipt = await sendAATxViaPaymaster(txParams)
    await expect(txReceipt.wait()).to.be.reverted

    expect((await erc20.balanceOf(user1.address))).to.eq(balances.User1TokenBal)
    expect((await erc20.balanceOf(account.address))).to.eq(balances.AccountTokenBal)

    const limit = await spendingManager.getLimit(account.address, erc20.address)
    expect(limit.limit).to.eq(toBN("15"))
    expect(limit.spent).to.eq(toBN("1.5"))
    expect(limit.resetTime.toNumber()).to.lt(Math.floor(Date.now() / 1000))
    expect(limit.isActive).to.eq(true)

    await consoleLimit(limit)

    await getBalances()

  })

  it("Transfer ERC20 3: Should revert first but succeed after the daily limit resets", async function() {

    const balances = await getBalances()

    let tx = await erc20.populateTransaction.transfer(user1.address, toBN("6"));
    tx.value = ethers.utils.parseEther("0")
    let txParams = await getParams(false, false, tx)

    const resetTime = ((await spendingManager.getLimit(account.address, erc20.address)).resetTime).toNumber()

    if (Math.floor(Date.now()/ 1000) <= resetTime + 15) { // before 15 seconds has passed
      const txReceipt = await sendAATxViaPaymaster(txParams)
      await expect(txReceipt.wait()).to.be.reverted
    }

    await sleep(15000); 

    if (Math.floor(Date.now()/ 1000) >= resetTime + 15) { // after 15 seconds has passed
        const txReceipt = await sendAATxViaPaymaster(txParams)
        await txReceipt.wait()
    }

    expect((await erc20.balanceOf(user1.address))).to.eq((balances.User1TokenBal.add(toBN("6"))))
    expect((await erc20.balanceOf(account.address))).to.eq(balances.AccountTokenBal.sub(toBN("6")))
  
      const limit = await spendingManager.getLimit(account.address, erc20.address)
      expect(limit.limit).to.eq(toBN("15"))
      expect(limit.spent).to.eq(toBN("6"))
      expect(limit.resetTime.toNumber()).to.gt(resetTime)
      expect(limit.isActive).to.eq(true)
  
      await consoleLimit(limit)
  
      await getBalances()
  })
  })

  describe("Spending Limit Updates", function () {

    beforeEach(async function () {
      let tx = await spendingManager.populateTransaction.setSpendingLimit(account.address, ETH_ADDRESS, toBN("10"));
      tx.value = ethers.utils.parseEther("0")
      let txParams = await getParams(true, false, tx)
    
      const txReceipt = await sendAATxViaPaymaster(txParams)
      await txReceipt.wait()

    });
    
  it("Should succeed after overwriting SpendLimit", async function() {
    let tx0 = {
      data: "0x",
      from: account.address,
      to: user1.address,
      value: ethers.utils.parseEther("12.5")
    }

    let txParams0 = await getParams(true, false, tx0)

    const txReceipt0 = await sendAATxViaPaymaster(txParams0)
    await expect(txReceipt0.wait()).to.be.reverted

    await sleep(15000); 

    // Increase Limit
    let tx1 = await spendingManager.populateTransaction.setSpendingLimit(account.address, ETH_ADDRESS, toBN("15"))
    tx1.value = ethers.utils.parseEther("0")
    let txParams1 = await getParams(true, false, tx1)

    const txReceipt1 = await sendAATxViaPaymaster(txParams1)
    await txReceipt1.wait()

    const balances = await getBalances()

    let txParams2 = txParams0
    const txReceipt2 = await sendAATxViaPaymaster(txParams2)
    await txReceipt2.wait()

    expect((await provider.getBalance(user1.address))).to.eq((balances.User1ETHBal.add(toBN("12.5"))))
    expect((await provider.getBalance(account.address))).to.eq(balances.AccountETHBal.sub(toBN("12.5")))

    const limit = await spendingManager.getLimit(account.address, ETH_ADDRESS)
    expect(limit.limit).to.eq(toBN("15"))
    expect(limit.spent).to.eq(toBN("12.5"))
    expect(limit.resetTime.toNumber()).to.lt(Math.floor(Date.now() / 1000))
    expect(limit.isActive).to.eq(true)

    await consoleLimit(limit)
    await getBalances()
    await sleep(15000);

  })

  it("Should succeed after removing SpendLimit", async function() { 
    let tx0 = {
      data: "0x",
      from: account.address,
      to: user1.address,
      value: ethers.utils.parseEther("15")
    }

    let txParams0 = await getParams(true, false, tx0)

    const txReceipt0 = await sendAATxViaPaymaster(txParams0)
    await expect(txReceipt0.wait()).to.be.reverted

    await sleep(15000); 

    // Increase Limit
    let tx1 = await spendingManager.populateTransaction.removeSpendingLimit(account.address, ETH_ADDRESS)
    tx1.value = ethers.utils.parseEther("0")
    let txParams1 = await getParams(true, false, tx1)

    const txReceipt1 = await sendAATxViaPaymaster(txParams1)
    await txReceipt1.wait()

    const balances = await getBalances()

    let txParams2 = txParams0
    const txReceipt2 = await sendAATxViaPaymaster(txParams2)
    await txReceipt2.wait()

    expect((await provider.getBalance(user1.address))).to.eq((balances.User1ETHBal.add(toBN("15"))))
    expect((await provider.getBalance(account.address))).to.eq(balances.AccountETHBal.sub(toBN("15")))

    const limit = await spendingManager.getLimit(account.address, ETH_ADDRESS)
    expect(limit.limit).to.eq(toBN("0"))
    expect(limit.spent).to.eq(toBN("0"))
    expect(limit.resetTime.toNumber()).to.eq(0)
    expect(limit.isActive).to.eq(false)

    await consoleLimit(limit)
    await getBalances()
    await sleep(15000);

  })


  it("Should revert. Invalid update of SpendLimit", async function() {

    // SetSpend Limit
    let tx1 = await spendingManager.populateTransaction.setSpendingLimit(account.address, ETH_ADDRESS, toBN("100"))
    tx1.value = ethers.utils.parseEther("0")
    tx1.gasLimit = BigNumber.from(500000) // to dodge tx estimation in "estimateGas" for revert case
    let txParams1 = await getParams(true, false, tx1)

    const txReceipt1 = await sendAATxViaPaymaster(txParams1)
    await expect(txReceipt1.wait()).to.be.reverted

    // SetSpend Limit
    let tx2 = await spendingManager.populateTransaction.removeSpendingLimit(account.address, ETH_ADDRESS)
    tx2.value = ethers.utils.parseEther("0")
    tx2.gasLimit = BigNumber.from(500000)
    let txParams2 = await getParams(true, false, tx2)

    const txReceipt2 = await sendAATxViaPaymaster(txParams2)
    await expect(txReceipt2.wait()).to.be.reverted

    const limit = await spendingManager.getLimit(account.address, ETH_ADDRESS)
    expect(limit.limit).to.eq(toBN("10"))
    expect(limit.spent).to.eq(toBN("0"))
    expect(limit.resetTime.toNumber()).to.lt(Math.floor(Date.now() / 1000))
    expect(limit.isActive).to.eq(true)

    await consoleLimit(limit)

  })
})

    /*
    1: Add addSpendingLimit for ether and ERC20 respectively
    2: executeTransaction ETH 
     * should go ok
       - expect1: sender & recepiet balances 
       - expect2: changes in account's Allowance values 
    
    * should go ok after changes in the allowance
       - expect1: resetAllowance 

    * should revert 
       - revert1: "insufficient allowance for 'trnasfer()' with the second transfer
       - revert2: "Allowance has expired" in decreaseSpendingLimit with advanceTime()
       - revert3: "Allowance hasn't expired" in addSpendingLimit with further advanceTime()
       - revert4: removeSpendingLimit -> resetAllowance
    
    3: executeTransaction ERC20

    */


const getParams = async function (_isApprovalBased:boolean, _isBatched:boolean, _txData:any): Promise<TxParams> {
  let txParams:TxParams = {
    provider, 
    erc20, 
    account, 
    paymaster, 
    wallet, 
    user1, 
    user2,
    isApprovalBased: _isApprovalBased,
    isBatched: _isBatched,
    txData: _txData,
   }
  return txParams;
}

async function getBalances() {

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

async function consoleLimit(limit) {

  console.log(
    '\n',
    '"Limit"', '\n',
    '- Limit: ', limit.limit.toString(), '\n',
    '- Spent: ', limit.spent.toString(), '\n',
    '- Reset Time: ', limit.resetTime.toString(), '\n',
    '- Now: ', (Math.floor(Date.now() / 1000)).toString(), '\n',
    '- isActive: ', limit.isActive.toString(), '\n',
    '\n',
  )
}

async function consoleAddreses() {
  console.log(
      '\n',
      '-- Addresses -- ','\n',
      '- ERC20 Addr: ', erc20.address, '\n',
      '- Factory Addr: ', factory.address, '\n',
      '- Paymaster Addr: ', paymaster.address, '\n',
      '- PriceFeed Addr: ', pricefeed.address, '\n',
      '- SpendingManager Addr: ', spendingManager.address, '\n',
      '- Wallet Addr: ', wallet.address, '\n',
      '- Account Addr: ', account.address, '\n',
      '- User1 Addr: ', user1.address, '\n',
      '- User2 Addr: ', user2.address, '\n',
      '\n',
    )
}