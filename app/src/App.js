import React, { useState, useEffect } from 'react'
import { useAragonApi } from '@aragon/api-react'
import {
  AppBar, AppView, Button, Card, CardLayout, Checkbox, Field, GU, Header, IconSettings,
  Info, Main, Modal, SidePanel, Text, TextInput, theme
} from '@aragon/ui'
import AirdropDetail from './AirdropDetail'
import Airdrops from './Airdrops'
import NewAirdrop from './NewAirdrop'
import { abi as NamesABI } from '../../build/contracts/SimpleNames.json'

const ipfsGateway = location.hostname === 'localhost' ? 'http://localhost:8080/ipfs' : 'https://ipfs.eth.aragon.network/ipfs'

function App() {
  const { api, network, appState, connectedAccount } = useAragonApi()
  const { count, airdrops = [], awarded, syncing } = appState

  const [namesContract, setNames] = useState()
  useEffect(()=>{
    if(!api) return
    api.call('names').toPromise()
      .then(addr=>api.external(addr, NamesABI))
      .then(setNames)
  }, [api, network])

  const [name, setName] = useState()
  useEffect(()=>{
    if(!namesContract) return
    namesContract.nameOf(connectedAccount).toPromise()
      .then(setName)
  }, [namesContract, connectedAccount])

  const [panelOpen, setPanelOpen] = useState(false)

  const [detailed, setDetailed] = useState([])
  useEffect(()=>{
    if(!airdrops || !name) return
    if(!detailed.length) setDetailed(airdrops)
    Promise.all(airdrops.map(async (a)=>{
      a.awarded = await api.call('awarded', a.id, name).toPromise()
      if(!a.data) a.data = await (await fetch(`${ipfsGateway}/${a.dataURI.split(':')[1]}`)).json()
      if(a.data && !a.userData) a.userData = a.data.recipients.find(d=>d.name===name)
      return a
    })).then(setDetailed)
  }, [airdrops, name])

  const [selected, setSelected] = useState()

  return (
    <Main>
      <Header primary="Airdrop" secondary={!selected && <Button mode="strong" onClick={()=>setPanelOpen(true)}>New airdrop</Button>} />
      <h1>{name}</h1>
      {selected
        ? <AirdropDetail airdrop={selected} onBack={()=>setSelected()} name={name} />
        : <Airdrops airdrops={detailed} onSelect={setSelected} name={name} />
      }
      <SidePanel title={"New Airdrop"} opened={panelOpen} onClose={()=>setPanelOpen(false)}>
        <NewAirdrop />
      </SidePanel>
    </Main>
  )
}

export default App
