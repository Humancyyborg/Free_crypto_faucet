// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleFaucet {
    address public owner;
    uint256 public withdrawalAmount;
    uint256 public lockTime;
    mapping(address => uint256) public lastWithdrawTime;

    bool private locked;

    event Withdrawal(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    modifier noReentrancy() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }

    constructor(uint256 _withdrawalAmount) {
        require(_withdrawalAmount > 0, "Withdrawal amount must be greater than zero");
        owner = msg.sender;
        withdrawalAmount = _withdrawalAmount;
        lockTime = 1 days;
        locked = false;
    }

    function withdrawTo(address payable _recipient) public onlyOwner noReentrancy {
        require(block.timestamp >= lastWithdrawTime[_recipient] + lockTime, "Recipient needs to wait 24hrs before next withdrawal");
        require(address(this).balance >= withdrawalAmount, "Insufficient balance in faucet");

        lastWithdrawTime[_recipient] = block.timestamp;
        _recipient.transfer(withdrawalAmount);

        emit Withdrawal(_recipient, withdrawalAmount);
    }

    function setWithdrawalAmount(uint256 _amount) public onlyOwner {
        require(_amount > 0, "Withdrawal amount must be greater than zero");
        withdrawalAmount = _amount;
    }

    function setLockTime(uint256 _lockTime) public onlyOwner {
        lockTime = _lockTime;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function withdraw(uint256 _amount) public onlyOwner noReentrancy {
        require(address(this).balance >= _amount, "Insufficient balance in faucet");
        payable(owner).transfer(_amount);
    }

    receive() external payable {}
}
