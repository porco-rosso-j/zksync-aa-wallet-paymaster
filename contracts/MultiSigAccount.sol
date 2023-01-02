pragma solidity ^0.8.0;

import '@matterlabs/zksync-contracts/l2/system-contracts/SystemContractsCaller.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/TransactionHelper.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol';
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "./interfaces/ISpendingManager.sol";

contract MultiSigAccount is IAccount, IERC1271 {
    using TransactionHelper for Transaction;

    bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

    ISpendingManager public spendingManager;
    address public owner1;
    address public owner2;

    constructor(address _owner1, address _owner2, ISpendingManager _spendingManager) {
        owner1 = _owner1;
        owner2 = _owner2;
        spendingManager = _spendingManager;
    }

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method.");
        _;
    }

    function validateTransaction(
        bytes32, 
        bytes32 _suggestedSignedHash, 
        Transaction calldata _transaction) 
        external payable override onlyBootloader 
        {
            _validateTransaction(_suggestedSignedHash, _transaction);
    }

    function _validateTransaction(bytes32 _suggestedSignedHash, Transaction calldata _transaction) internal {
        // Incrementing the nonce of the account
        // reserved[0] is the current nonce
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(INonceHolder.incrementMinNonceIfEquals, (_transaction.reserved[0]))
        );

        // set txHash in case suggestedHash isnt provided.
        bytes32 txHash = _suggestedSignedHash == bytes32(0) ? _transaction.encodeHash() : _suggestedSignedHash;
        require(isValidSignature(txHash, _transaction.signature) == EIP1271_SUCCESS_RETURN_VALUE);
    }

    function executeTransaction(bytes32, bytes32, Transaction calldata _transaction) external payable override onlyBootloader {
        if (isBatched(_transaction)) {
            _executeBatchTransaction(_transaction);
        } else {
            _executeTransaction(_transaction);
        }
    }
    
    function isBatched(Transaction calldata _transaction) internal pure returns(bool) {
        bytes memory data = _transaction.data;

        if ( _transaction.to == _transaction.from && data.length != 0) {
            return true;
        } else {
            return false;
        }
        
    }
    function _executeBatchTransaction(Transaction calldata _transaction) internal {

        (address[] memory targets, bytes[] memory methods, uint[] memory values) 
        = abi.decode(_transaction.data, (address[], bytes[], uint[]));

        address to;
        bytes memory data;
        uint value;

        bool success;

        for (uint i = 0; i < targets.length; i++) {

            to = targets[i];
            data = methods[i];
            value = values[i];

            assembly { 
                success := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)
            }

            require(success, "MultiCall Failed");
        }
    }

    function _executeTransaction(Transaction calldata _transaction) internal {

        address from = address(uint160(_transaction.from));
        address to = address(uint160(_transaction.to));
        uint value = _transaction.reserved[1];
        bytes memory data = _transaction.data;

        spendingManager.checkSpendingLimit(from, to, value, data);

        if(to == address(DEPLOYER_SYSTEM_CONTRACT)) {
            SystemContractsCaller.systemCallWithPropagatedRevert(
                uint32(gasleft()),
                to,
                uint128(_transaction.reserved[1]),
                _transaction.data
            );
        } else {
            bool success;
            assembly {
                success := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)
            }
            require(success);
        }

    }

    function executeTransactionFromOutside(Transaction calldata _transaction) external payable {
        _validateTransaction(bytes32(0), _transaction);

        if (isBatched(_transaction)) {
            _executeBatchTransaction(_transaction);
        } else {
            _executeTransaction(_transaction);
        }
    }

    function isValidSignature(bytes32 _hash, bytes calldata _signature) public override view returns(bytes4) {
        require(_signature.length == 130, "Signature length is incorrect");

        require(ECDSA.recover(_hash, _signature[0:65]) == owner1, "wrong address for owner1");
        require(ECDSA.recover(_hash, _signature[65:130]) == owner2, "wrong address for owner2");

        return EIP1271_SUCCESS_RETURN_VALUE;
    }

    function payForTransaction(bytes32, bytes32, Transaction calldata _transaction) external payable override onlyBootloader {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    function prePaymaster(bytes32, bytes32, Transaction calldata _transaction) external payable override onlyBootloader {

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);
        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {

        (address token, , bytes memory data) 
        = abi.decode(_transaction.paymasterInput[4:], (address, uint, bytes));
        address paymaster = address(uint160(_transaction.paymaster));

        uint token_price = abi.decode(data, (uint));
        uint token_fee = (_transaction.ergsLimit * _transaction.maxFeePerErg) * 1e18 / token_price;

        address user = address(uint160(_transaction.from));
        uint allowance = IERC20(token).allowance(user, paymaster);

        if ( token_fee > allowance ) {
        bool success = IERC20(token).approve(paymaster, token_fee);
        require(success, "Failed to pay the fee to the paymaster");
        } else {
        revert("insufficient allowance for paymaster");
        }

        }

        _transaction.processPaymasterInput();
    }

    receive() external payable {
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);
    }

    fallback() external payable { }

}