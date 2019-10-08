pragma solidity ^0.4.24;

/*
    Names contract interface
*/
contract INames {
    function addressOf(string _name) public view returns(address);
    function nameOf(address _address) public view returns(string);
}
