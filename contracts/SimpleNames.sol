pragma solidity ^0.4.24;

import './INames.sol';

/*
    Names contract
*/
contract SimpleNames is INames {

    mapping(bytes32 => address) public namehashToAddress;
    mapping(address => string) public addressToName;

    string private constant ERROR_EXISTS = "EXISTS";

    function register(address _address, string _name) public {
        bytes32 namehash = keccak256(_name);
        require( namehashToAddress[namehash] == address(0), ERROR_EXISTS );
        require( bytes(addressToName[_address]).length == 0, ERROR_EXISTS );

        namehashToAddress[namehash] = _address;
        addressToName[_address] = _name;
    }

    function addressOf(string _name) public view returns(address){
        return namehashToAddress[keccak256(_name)];
    }

    function nameOf(address _address) public view returns(string){
        return addressToName[_address];
    }
}
