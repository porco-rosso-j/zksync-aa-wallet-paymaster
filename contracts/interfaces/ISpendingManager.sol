pragma solidity ^0.8.0;

interface ISpendingManager {
    function setSpendingLimit(address _account, address _token, uint _amount) external;
    function removeSpendingLimit(address _account, address _token) external;
    function checkSpendingLimit(address _account, address _token, uint _amount, bytes memory _data) external;
}