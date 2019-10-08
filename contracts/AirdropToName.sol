pragma solidity ^0.4.24;
/* pragma experimental ABIEncoderV2; */

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";

import './INames.sol';

contract AirdropToName is AragonApp {

    struct Airdrop {
      bytes32 root;
      string dataURI;
      mapping(bytes32 => bool) awarded;
    }

    /// Events
    event Start(uint id);
    event Award(uint id, address recipient, uint amount);

    /// State
    mapping(uint => Airdrop) public airdrops;
    TokenManager public tokenManager;
    INames public names;
    uint public airdropsCount;

    /// ACL
    bytes32 constant public START_ROLE = keccak256("START_ROLE");
    bytes32 constant public SET_NAME_PROVIDER = keccak256("SET_NAME_PROVIDER");

    // Errors
    string private constant ERROR = "ERROR";
    string private constant ERROR_PERMISSION = "PERMISSION";
    string private constant ERROR_NOT_FOUND = "NOT_FOUND";
    string private constant ERROR_INVALID = "INVALID";

    function initialize(address _tokenManager, address _names) onlyInit public {
        initialized();

        tokenManager = TokenManager(_tokenManager);
        names = INames(_names);
    }

    /**
     * @notice Start a new airdrop `_root` / `_dataURI`
     * @param _root New airdrop merkle root
     * @param _dataURI Data URI for airdrop data
     */
    function start(bytes32 _root, string _dataURI) auth(START_ROLE) public {
        _start(_root, _dataURI);
    }

    function _start(bytes32 _root, string _dataURI) internal returns(uint id){
        id = ++airdropsCount;    // start at 1
        airdrops[id] = Airdrop(_root, _dataURI);
        emit Start(id);
    }

    /**
     * @notice Set the name provdier contract
     * @param _names New name provider contract
     */
    function setNames(address _names) auth(SET_NAME_PROVIDER) public {
        names = INames(_names);
    }

    /**
     * @notice Award from airdrop
     * @param _id Airdrop id
     * @param _name Recepient of award
     * @param _amount The amount
     * @param _proof Merkle proof to correspond to data supplied
     */
    function award(uint _id, string _name, uint256 _amount, bytes32[] _proof) public {

        address recipient = names.addressOf(_name);
        require( recipient != address(0), ERROR_NOT_FOUND );
        bytes32 namehash = keccak256(_name);

        Airdrop storage airdrop = airdrops[_id];

        bytes32 hash = keccak256(_name, _amount);
        require( validate(airdrop.root, _proof, hash), ERROR_INVALID );

        require( !airdrops[_id].awarded[namehash], ERROR_PERMISSION );

        airdrops[_id].awarded[namehash] = true;

        tokenManager.mint(recipient, _amount);

        emit Award(_id, recipient, _amount);
    }

    /**
     * @notice Award from airdrop
     * @param _ids Airdrop ids
     * @param _name Recepient of award
     * @param _amounts The amounts
     * @param _proofs Merkle proofs
     * @param _proofLengths Merkle proof lengths
     */
    function awardFromMany(uint[] _ids, string _name, uint[] _amounts, bytes _proofs, uint[] _proofLengths) public {

        address recipient = names.addressOf(_name);
        require( recipient != address(0), ERROR_NOT_FOUND );
        bytes32 namehash = keccak256(_name);

        uint totalAmount;

        uint marker = 32;

        for (uint i = 0; i < _ids.length; i++) {
            uint id = _ids[i];

            bytes32[] memory proof = extractProof(_proofs, marker, _proofLengths[i]);
            marker += _proofLengths[i]*32;

            bytes32 hash = keccak256(_name, _amounts[i]);
            require( validate(airdrops[id].root, proof, hash), ERROR_INVALID );

            require( !airdrops[id].awarded[namehash], ERROR_PERMISSION );

            airdrops[id].awarded[namehash] = true;

            totalAmount += _amounts[i];

            emit Award(id, recipient, _amounts[i]);
        }

        tokenManager.mint(recipient, totalAmount);

    }

    /**
     * @notice Award from airdrop
     * @param _id Airdrop ids
     * @param _names Recepients of award
     * @param _amounts The amounts
     * @param _proofs Merkle proofs
     * @param _proofLengths Merkle proof lengths
     */
    function awardToMany(uint _id, bytes32[] _names, uint[] _amounts, bytes _proofs, uint[] _proofLengths) public {

        uint marker = 32;

        for (uint i = 0; i < _names.length; i++) {
            string memory name = string( bytes32ToBytes(_names[i]) );
            address recipient = names.addressOf(name);
            bytes32 namehash = keccak256(name);

            if( recipient == address(0) )
                continue;

            if( airdrops[_id].awarded[namehash] )
                continue;

            airdrops[_id].awarded[namehash] = true;

            bytes32[] memory proof = extractProof(_proofs, marker, _proofLengths[i]);
            marker += _proofLengths[i]*32;

            bytes32 hash = keccak256(name, _amounts[i]);
            if( !validate(airdrops[_id].root, proof, hash) )
                continue;

            tokenManager.mint(recipient, _amounts[i]);

            emit Award(_id, recipient, _amounts[i]);
        }

    }

    function extractProof(bytes _proofs, uint _marker, uint proofLength) public pure returns (bytes32[] proof) {

        proof = new bytes32[](proofLength);

        bytes32 el;

        for (uint j = 0; j < proofLength; j++) {
            assembly {
                el := mload(add(_proofs, _marker))
            }
            proof[j] = el;
            _marker += 32;
        }

    }

    function validate(bytes32 root, bytes32[] proof, bytes32 hash) public pure returns (bool) {

        for (uint i = 0; i < proof.length; i++) {
            if (hash < proof[i]) {
                hash = keccak256(hash, proof[i]);
            } else {
                hash = keccak256(proof[i], hash);
            }
        }

        return hash == root;
    }

    /**
     * @notice Check if `_name` claimed in airdrop:`_id`
     * @param _id Airdrop id
     * @param _name Name to check
     */
    function awarded(uint _id, string _name) public view returns(bool) {
        bytes32 namehash = keccak256(_name);
        return airdrops[_id].awarded[namehash];
    }

    function bytes32ToBytes(bytes32 data) public pure returns (bytes result) {
        uint len = 0;
        while (len < 32 && uint(data[len]) != 0) {
            ++len;
        }

        assembly {
            result := mload(0x40)
            mstore(0x40, add(result, and(add(add(len, 0x20), 0x1f), not(0x1f))))
            mstore(result, len)
            mstore(add(result, 0x20), data)
        }
    }
}
