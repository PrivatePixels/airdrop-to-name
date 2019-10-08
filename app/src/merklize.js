const MerkleTree = require("merkle-tree-solidity").default
const utils = require("ethereumjs-util")
const setLengthLeft = utils.setLengthLeft
const setLengthRight = utils.setLengthRight
const csv = require('csvtojson')
const BigNumber = require('bignumber.js')

const decimals = BigNumber(10).pow(18)

module.exports = function(data, nameField, amountField) {
  const recipients = data.filter(r=>!!r[nameField]).reduce((prev, curr)=>{
    let name = curr[nameField].replace('u/','')
    let existing = prev.find(u=>u.name===name)
    let amount = BigNumber(curr[amountField])
    if(existing) existing.amount = existing.amount ? existing.amount.plus(amount) : amount
    else prev.push({name, amount})
    return prev
  }, [])

  const recipientHashBuffers = recipients.map(r=>{
    r.amount = r.amount.times(decimals)
    let nameBuffer = utils.toBuffer(r.name)
    let amountBuffer = setLengthLeft(utils.toBuffer("0x"+r.amount.toString(16)), 32)
    let hashBuffer = utils.keccak256(Buffer.concat([nameBuffer, amountBuffer]))
    let hash = utils.bufferToHex(hashBuffer)
    r.amount = r.amount.toFixed()

    return hashBuffer
  })

  const merkleTree = new MerkleTree(recipientHashBuffers)

  const root = utils.bufferToHex(merkleTree.getRoot())

  recipients.forEach((recipient,idx)=>{
    recipient.proof = merkleTree.getProof(recipientHashBuffers[idx]).map(p=>utils.bufferToHex(p))
    return recipient
  })

  console.log(`root:`, root)

  return {root, recipients}
}
