pragma solidity ^0.8.0;

import '@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol';
import "./vendors/BytesLib.sol";
import "./interfaces/ISpendingManager.sol";

contract SpendingManager is ISpendingManager {

    using BytesLib for bytes;

    bytes4 constant public ERC20_TRANSFER_SELECTOR = 0xa9059cbb;

    uint public ONE_DAY = 24 hours;

    struct Limit {
        uint limit;
        uint spent;
        uint resetTime;
        bool isActive;
    }

    mapping(address => mapping(address => Limit)) public limits; // account => token => Limit

    function getLimit(address _account, address _token) public view returns(Limit memory) {
        Limit memory limit = limits[_account][_token];
        if (block.timestamp >= limit.resetTime + ONE_DAY && limit.isActive) {
            limit.resetTime = block.timestamp;
            limit.spent = 0;
        }
        return limit;
    }

    function setSpendingLimit(address _account, address _token, uint _amount) external {
        require(msg.sender == _account, "Invalid caller");
        require(_account != address(0), "Invalid account"); 
        require(_amount != 0, "Invalid amount");
        _updateLimit(_account, _token, _amount, 0, block.timestamp, true);
    } 

    function removeSpendingLimit(address _account, address _token) external {
        require(msg.sender == _account, "Invalid caller");
        require(_account != address(0), "Invalid account");  
        _updateLimit(_account, _token, 0, 0, 0, false);
    }

    function _updateLimit(address _account, address _token, uint _limit, uint _spent, uint _resetTime, bool _isActive) private {
        Limit storage limit = limits[_account][_token];
        require(limit.resetTime + ONE_DAY <= block.timestamp, "Invalid update");

        limit.limit = _limit;
        limit.spent = _spent;
        limit.resetTime = _resetTime;
        limit.isActive = _isActive;
    }

    function checkSpendingLimit(address _account, address _token, uint _amount, bytes calldata _data) public{

        // ETH
        if ( _amount > 0 ) {
          _checkSpendingLimit(_account, address(ETH_TOKEN_SYSTEM_CONTRACT), _amount);
        }

        // ERC20
        if ( BytesLib.getSelector(_data) == ERC20_TRANSFER_SELECTOR ) {
          (, _amount) = BytesLib.decodeArgs(_data);
          _checkSpendingLimit(_account, _token, _amount);
        }
    }

    function _checkSpendingLimit(address _account, address _token, uint _amount) internal {
        Limit memory limit = getLimit(_account, _token);

        if(!limit.isActive) return;
        require(limit.limit - limit.spent >= _amount, 'Exceed spending limit for trnasfer');

        limit.spent += _amount;
        limits[_account][_token] = limit;
    }

    // testing purpose: can set it to 10~30 sec for testing.
    function changeONE_DAY(uint _time) public {
        ONE_DAY = _time;
    }

}