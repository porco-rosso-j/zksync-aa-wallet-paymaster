pragma solidity ^0.8.0;

import "@matterlabs/zksync-contracts/l2/system-contracts/SystemContractsCaller.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/TransactionHelper.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

import "./TestSpendLimit.sol";
import "../libraries/MulticallHelper.sol";
import "../base/SignerManager.sol";
import "../BaseAccount.sol";

contract TestAccount is
    BaseAccount,
    SignerManager,
    TestSpendLimit,
    MulticallHelper
{
    using TransactionHelper for Transaction;

    constructor(address[] memory _signers, uint256 _threshold) {
        setup(_signers, _threshold);
    }

    function _validateTransaction(
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) internal override {
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(
                INonceHolder.incrementMinNonceIfEquals,
                (_transaction.reserved[0])
            )
        );

        bytes32 txHash = _suggestedSignedHash == bytes32(0)
            ? _transaction.encodeHash()
            : _suggestedSignedHash;
        require(
            isValidSignature(txHash, _transaction.signature) ==
                EIP1271_SUCCESS_RETURN_VALUE
        );
    }

    function _executeTransaction(Transaction calldata _transaction)
        internal
        override
    {
        address to = address(uint160(_transaction.to));
        uint256 value = _transaction.reserved[1];
        bytes memory data = _transaction.data;

        if (isBatched(data)) {
            _executeBatchTransaction(data);
        } else if (to == address(DEPLOYER_SYSTEM_CONTRACT)) {
            _executeDeployment(to, value, data);
        } else {
            _execute(to, value, data);
        }
    }

    function _executeBatchTransaction(bytes memory _data) internal {
        (
            address[] memory targets,
            bytes[] memory methods,
            uint256[] memory values
        ) = _decodeBatchData(_data);

        address to;
        bytes memory data;
        uint256 value;

        for (uint256 i = 0; i < targets.length; i++) {
            to = targets[i];
            data = methods[i];
            value = values[i];

            _execute(to, value, data);
        }
    }

    function _executeDeployment(
        address _to,
        uint256 _value,
        bytes memory _data
    ) internal {
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            _to,
            uint128(_value),
            _data
        );
    }

    function _execute(
        address _to,
        uint256 _value,
        bytes memory _data
    ) internal {
        require(
            _checkSpendingLimit(_to, _value, _data),
            "the spending exceeds the limit"
        );

        bool success;

        assembly {
            success := call(
                gas(),
                _to,
                _value,
                add(_data, 0x20),
                mload(_data),
                0,
                0
            )
        }

        require(success);
    }

    fallback() external payable {}
}
