import * as chai from "chai";
const expect = chai.expect;
import { solidity } from 'ethereum-waffle';
chai.use(solidity);
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { BigNumber, ethers } from "ethers";
const rich_wallet = require('../../local-setup/rich-wallets');

const dev_pk = rich_wallet[0].privateKey
const wallet2 = rich_wallet[1].address

const toBN = (x: string): BigNumber => {
    return ethers.utils.parseEther(x)
}

async function deployToken(deployer: Deployer): Promise<Contract> {
    const artifact = await deployer.loadArtifact("MyERC20");
    return await deployer.deploy(artifact, ["MyERC20", "MyERC20", 18]);
  }

async function deployPaymaster(deployer: Deployer, erc20address: string): Promise<Contract> {
  const artifact = await deployer.loadArtifact("Paymaster");
  return await deployer.deploy(artifact, [erc20address]);
}

let provider
let wallet 
let deployer
let erc20
let paymaster

before(async () => {
    provider = Provider.getDefaultProvider();
    wallet = new Wallet(dev_pk, provider);
    deployer = new Deployer(hre, wallet);

    erc20 = await deployToken(deployer);
    paymaster = await deployPaymaster(deployer, erc20.address);

    await(await paymaster.setETHPerToken(toBN("0.000825"))).wait()

    await (await wallet.sendTransaction({
        to: paymaster.address,
        value: ethers.utils.parseEther("1")
    })).wait()

})

describe("Paymaster Test: Deployment & Set-up", function () {
  it("Should deploy ERC20 correctly", async function () {

    expect(await erc20.name()).to.equal("MyERC20")
    expect(await erc20.decimals()).to.equal(18)

    const erc20addr: string = await paymaster.allowedToken()
    expect(erc20addr).to.equal(erc20.address)

    console.log(
        '\n',
        '- Wallet Addr: ', wallet.address, '\n',
        '- Paymaster Addr: ', paymaster.address, '\n',
        '- ERC20 Addr: ', erc20.address, '\n',
        '- paymaster ETH balance: ', (await provider.getBalance(paymaster.address)).toString(), '\n',
        '- Wallet ETH balance: ', (await provider.getBalance(wallet.address)).toString(), '\n',
        '- Done :', '\n',
        '\n',
      )
  });

  it("Transfer: Should transfer Token from main wallet to another wallet via Paymaster", async function () {

    await(await erc20.mint(wallet.address, ethers.utils.parseEther("100"))).wait()
    await(await erc20.approve(paymaster.address, toBN("1"))).wait()
    const WalletETHBalBefore = await provider.getBalance(wallet.address)

    console.log(
        '\n',
        'Before tx', '\n',
        '- Paymaster Addr: ', paymaster.address, '\n',
        '- ERC20 Addr: ', erc20.address, '\n',
        '- Paymaster token balance: ', (await erc20.balanceOf(paymaster.address)).toString(), '\n',
        '- Wallet Token balance: ', (await erc20.balanceOf(wallet.address)).toString(), '\n',
        '- Wallet2 Token balance: ',  (await erc20.balanceOf(wallet2)).toString(), '\n',
        '- Paymaster ETH balance: ', (await provider.getBalance(paymaster.address)).toString(), '\n',
        '- Wallet ETH balance: ', (WalletETHBalBefore).toString(), '\n',
        '- Done', '\n',
        '\n',
      )

    const gasPrice = await provider.getGasPrice();
    const gasLimit = await erc20.estimateGas.transfer(wallet2, ethers.utils.parseEther("15"), {
        customData: {
            ergsPerPubdata: utils.DEFAULT_ERGS_PER_PUBDATA_LIMIT,
            paymasterParams: {
                paymaster: paymaster.address,
                paymasterInput: "0x"
            },
        },
    });

    const gasETH = gasPrice * gasLimit

    const paymasterParams = utils.getPaymasterParams(paymaster.address, {
        type: "ApprovalBased",
        token: erc20.address,
        minimalAllowance: toBN("0"),
        innerInput: new Uint8Array()
    });

    await(await erc20.transfer(wallet2, toBN("15"), {
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: gasPrice,
        gasLimit,
        customData: {
            paymasterParams,
            ergsPerPubdata: utils.DEFAULT_ERGS_PER_PUBDATA_LIMIT
        },
    })).wait()

    const PaymasterTokenBal = await erc20.balanceOf(paymaster.address)
    const WalletTokenBal = await erc20.balanceOf(wallet.address)
    const Wallet2TokenBal = await erc20.balanceOf(wallet2)
    const PaymasterETHBal = await provider.getBalance(paymaster.address)
    const WalletETHBal = await provider.getBalance(wallet.address)

    const paymaster_token_bal:BigNumber = (toBN(gasETH.toString())).div(toBN("0.000825")) 
    expect(PaymasterTokenBal).to.equal(paymaster_token_bal)
    expect(WalletTokenBal).to.closeTo(toBN("85"), toBN("0.1"))
    expect(Wallet2TokenBal).to.eq(toBN("15"))
    expect(PaymasterETHBal).to.lt(toBN("1"))
    expect(WalletETHBal).to.eq(WalletETHBalBefore)

    console.log(
        '\n',
        'After tx', '\n',
        '- Paymaster token balance: ', PaymasterTokenBal.toString(), '\n',
        '- Wallet Token balance: ', WalletTokenBal.toString(), '\n',
        '- Wallet2 Token balance: ',  Wallet2TokenBal.toString(), '\n',
        '- Paymaster ETH balance: ', PaymasterETHBal.toString(), '\n',
        '- Wallet ETH balance: ', WalletETHBal.toString(), '\n',
        '- Done', '\n',
        '\n',
      )
})
});