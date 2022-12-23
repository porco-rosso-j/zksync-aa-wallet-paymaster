pragma solidity ^0.8.0;

import '@matterlabs/zksync-contracts/l2/system-contracts/SystemContractsCaller.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/TransactionHelper.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol';
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";


contract MultiSigAccount is IAccount, IERC1271 {
    using TransactionHelper for Transaction;

    address public owner1;
    address public owner2;

    constructor(address _owner1, address _owner2) {
        owner1 = _owner1;
        owner2 = _owner2;
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
        _executeTransaction(_transaction);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint value = _transaction.reserved[1];
        bytes memory data = _transaction.data;

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
        _executeTransaction(_transaction);
    }

    bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

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
        _transaction.processPaymasterInput();
    }

    receive() external payable {
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);
    }


}