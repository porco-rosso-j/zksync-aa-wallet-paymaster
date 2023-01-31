
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../modules/SpendLimit/SpendLimit.sol';

contract TestSpendLimit is SpendLimit {

    function changeONE_DAY(uint _time) public {
        ONE_DAY = _time;
    }

    function getTimestamp() public view returns(uint) {
        return block.timestamp;
    }

}