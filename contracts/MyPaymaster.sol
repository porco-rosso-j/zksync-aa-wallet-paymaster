pragma solidity ^0.8.0;

import { IPaymaster, ExecutionResult } from '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol';
import { IPaymasterFlow } from '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol';
import { TransactionHelper, Transaction } from '@matterlabs/zksync-contracts/l2/system-contracts/TransactionHelper.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol';
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MyPaymaster is IPaymaster {
    address public owner;

    struct TokenInfo {
        uint minFee;
        bool sponsored;
        address pricefeed;
    }

    mapping (address => TokenInfo ) public tokens;

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        // Continue execution if called from the bootloader.
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner is allowed");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function validateAndPayForPaymasterTransaction(bytes32, bytes32, Transaction calldata _transaction) 
    external payable override onlyBootloader returns (bytes memory context) {
        require(_transaction.paymasterInput.length >= 4, 
        "The standard paymaster input must be at least 4 bytes long");

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);

        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {

            (address token, , ) 
            = abi.decode(_transaction.paymasterInput[4:], (address, uint, bytes));
            address user = address(uint160(_transaction.from));
            require(tokens[token].sponsored == true, "Invalid Token");

            (uint token_fee, uint eth_fee)
             = calcuFees(_transaction.ergsLimit, _transaction.maxFeePerErg, token);

            receiveToken(token, token_fee, user);
            payErgs(eth_fee);

        } else if (paymasterInputSelector == IPaymasterFlow.general.selector) {

            uint eth_fee = _transaction.ergsLimit * _transaction.maxFeePerErg;
            payErgs(eth_fee);
        
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    // token_fee: token amount for gas == eth amount for gas / {eth/token} rate
    function calcuFees(uint _ergsLimit, uint _maxFeePerErg, address _token) internal view returns(uint, uint) {
        uint eth_fee = _ergsLimit * _maxFeePerErg;
        uint token_fee = eth_fee * 1e18 / getETHPerToken(_token);
        return (token_fee, eth_fee);
    }

    // transrfer: send token from user to paymster(address(this))
    // require: check if paymaster received sufficient amount of token 
    function receiveToken(address _token, uint _token_amt, address _user) internal {

        uint balanceBefore = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transferFrom(_user, address(this), _token_amt);
        require(IERC20(_token).balanceOf(address(this)) >= _token_amt + balanceBefore, "Insufficient Token received");
    }

    function payErgs(uint _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: _eth_fee}("");
        require(success, "gas payment failed");
    }


    // Management Functions
    function addToken(address _token, uint _amount, bool _sponsored, address _feed) public onlyOwner {
        tokens[_token].minFee = _amount;
        tokens[_token].sponsored = _sponsored;
        tokens[_token].pricefeed = _feed;
    }

    function addMinTokenFee(address _token, uint _amount) public onlyOwner {
        tokens[_token].minFee = _amount;
    }

    function addTokenFeed(address _token, address _feed) public onlyOwner {
        require(tokens[_token].sponsored == true, "token not allowed");
        tokens[_token].pricefeed = _feed;
    }

    function getETHPerToken(address _token) public view returns(uint) {
        require(tokens[_token].pricefeed != address(0), "the token doesn't have pricefeed");
        (, int price, , ,) = AggregatorV3Interface(tokens[_token].pricefeed).latestRoundData();
        return uint(price);
    }

    /*
    function swapTokenForETH(address _token, uint _amount) public onlyOwner {
        IUniswapRouterV2(uni_router).swap...
    }
    */

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