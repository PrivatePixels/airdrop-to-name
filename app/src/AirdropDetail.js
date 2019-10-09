import React, { useState, useEffect } from 'react'
import { useAragonApi } from '@aragon/api-react'
import {
  AppBar, AppView, BackButton, Bar, Button, Card, CardLayout, Checkbox, Field, GU, Header, IconSettings,
  Info, Main, Modal, SidePanel, Text, TextInput, theme
} from '@aragon/ui'
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"

function Airdrop({airdrop, onBack}){
  return (
    <React.Fragment>
      <Bar>
        <BackButton onClick={onBack} />
      </Bar>
    </React.Fragment>
  )
}

async function awardToMany(api, names, id, data){
  // filter first 50 that
  // 1. is registered
  // 2. last claim is id-1
  // 3. above some value threshold?

  let idx = 0, recipients = [], awards = [], proofLengths = [], proofs = "0x"
  while (recipients.length < 50 && idx < data.recipients.length){
    let claim = data.recipients[idx]
    let address = claim.address
    if(!address || address === NULL_ADDRESS)
      continue
    let awarded = await api.call('awarded', id, address).toPromise()
    if(awarded)
      continue

    recipients.push(claim.address)
    awards.push(claim.amount)
    proofs += claim.proof.map(p=>p.slice(2)).join("")
    proofLengths.push(claim.proof.length)
    idx++
  }

  console.log(recipients.length)

  await api.awardToMany(id, recipients, awards, proofs, proofLengths).toPromise()
}

export default Airdrop
