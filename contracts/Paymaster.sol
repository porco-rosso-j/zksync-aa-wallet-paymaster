pragma solidity ^0.8.0;

import { IPaymaster, ExecutionResult } from '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol';
import { IPaymasterFlow } from '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol';
import { TransactionHelper, Transaction } from '@matterlabs/zksync-contracts/l2/system-contracts/TransactionHelper.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol';

contract Paymaster is IPaymaster {
    uint public minTokenFee;
    uint public ETH_PER_TOKEN; // 0.000825 {eth/token}, suppose token == usd stable
    address public allowedToken;

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        // Continue execution if called from the bootloader.
        _;
    }

    constructor(address _erc20) {
        allowedToken = _erc20;
    }

    function validateAndPayForPaymasterTransaction(bytes32, bytes32, Transaction calldata _transaction) 
    external payable override onlyBootloader returns (bytes memory context) {
        require(_transaction.paymasterInput.length >= 4, 
        "The standard paymaster input must be at least 4 bytes long");

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);

        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {

            (address token, uint minAllonwance, bytes memory data) 
            = abi.decode(_transaction.paymasterInput[4:], (address, uint, bytes));
            address user = address(uint160(_transaction.from));
            require(token == allowedToken, "Invalid Token");
            require(minAllonwance >= minTokenFee, "Insufficient Allowance");

            (uint token_fee, uint eth_fee) = calcuFees(_transaction.ergsLimit, _transaction.maxFeePerErg);

            receiveToken(token, token_fee, user);
            payErgs(eth_fee);

        } else {
            revert("Unsupported paymaster flow");
        }
    }

    // token_fee: token amount for gas == eth amount for gas / {eth/token} rate
    function calcuFees(uint _ergsLimit, uint _maxFeePerErg) internal view returns(uint, uint) {
        uint eth_fee = _ergsLimit * _maxFeePerErg;
        uint token_fee = eth_fee * 1e18 / getETHPerToken();
        return (token_fee, eth_fee);
    }

    // require1: check user's allowance for paymaster
    // transrfer: send token from user to paymster(address(this))
    // require2: check if paymaster received sufficient amount of token 
    function receiveToken(address _token, uint _token_amt, address _user) internal {
        uint allowance = IERC20(_token).allowance(_user, address(this));
        require(allowance >= _token_amt, "The user didn't provide enough allowance");

        uint balanceBefore = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transferFrom(_user, address(this), _token_amt);
        require(IERC20(_token).balanceOf(address(this)) >= _token_amt + balanceBefore, "Insufficient Token received");
    }

    function payErgs(uint _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: _eth_fee}("");
        require(success, "gas payment failed");
    }

    function setMinTokenFee(uint _amount) public {
        minTokenFee = _amount;
    }

    function setETHPerToken(uint _rate) public { // OnlyOwner in production
        ETH_PER_TOKEN = _rate;
    }

    function getETHPerToken() public view returns(uint) {
        // issue: this function should call an oracle in production
        return ETH_PER_TOKEN;
    }

    function postOp(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32 _txHash,
        bytes32 _suggestedSignedHash, 
        ExecutionResult _txResult,
        uint _maxRefundedErgs
    ) external override payable onlyBootloader {
        // this contract doesnt support any refund logic tho
    }

    receive() external payable {
    }
}