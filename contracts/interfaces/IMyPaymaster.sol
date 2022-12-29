pragma solidity ^0.8.0;
import { IPaymasterFlow } from '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol';

interface IMyPaymaster {
    function getETHPerToken(address token) external view returns(uint);
}