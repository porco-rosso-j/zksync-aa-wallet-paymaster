pragma solidity ^0.8.0;

import '@matterlabs/zksync-contracts/l2/system-contracts/SystemContractsCaller.sol';
import '@matterlabs/zksync-contracts/l2/system-contracts/TransactionHelper.sol';
import "./BytesLib.sol";

contract MulticallHelper {
    using TransactionHelper for Transaction;
    using BytesLib for bytes;

    // keccak256(_executeBatchTransaction(bytes memory))
    bytes4 constant public BATCH_TX_SELECTOR = 0x7c3068b5;

    function isBatched(bytes memory _data) internal pure returns(bool) {
        bytes4 selector = BytesLib.getSelector(_data);
        return selector == BATCH_TX_SELECTOR ? true : false;
    }

    function _decodeBatchData(bytes memory _data) internal pure returns(
        address[] memory targets,
        bytes[] memory methods,
        uint[] memory values
        ) {

        (, targets, methods, values) 
        = abi.decode(_data, (bytes4, address[], bytes[], uint[]));

        return (targets, methods, values);
    }

}