pragma solidity ^0.8.0;

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/SystemContractsCaller.sol";

contract AccountFactory {
    bytes32 public maBytecodeHash;

    constructor(bytes32 _maBytecodeHash) {
        maBytecodeHash = _maBytecodeHash;
    }

    function deployAccount(bytes32 salt, address owner) external returns (address accountAddress) {
        (bool success, bytes memory returnData) = SystemContractsCaller.systemCallWithReturndata(
            uint32(gasleft()), address(DEPLOYER_SYSTEM_CONTRACT), uint128(0), 
            abi.encodeCall(
                DEPLOYER_SYSTEM_CONTRACT.create2Account, 
                (salt, maBytecodeHash, abi.encode(owner))
                )
        );

        require(success, "Deployment Failed");
        (accountAddress, ) = abi.decode(returnData, (address, bytes));
    }
}