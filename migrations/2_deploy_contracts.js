/* global artifacts */
var AirdropToName = artifacts.require('AirdropToName.sol')

module.exports = function(deployer) {
  deployer.deploy(AirdropToName)
}
