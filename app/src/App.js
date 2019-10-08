import React, { useState, useEffect } from 'react'
import { useAragonApi } from '@aragon/api-react'
import {
  AppBar, AppView, Button, Card, CardLayout, Checkbox, Field, GU, IconSettings,
  Info, Main, Modal, SidePanel, Text, TextInput, theme
} from '@aragon/ui'
import { abi as NamesABI } from '../../build/contracts/SimpleNames.json'
import csv from 'csvtojson'
import merklize from './merklize'
import ipfsClient from 'ipfs-http-client'
import { ethers } from 'ethers';

const ipfsGateway = location.hostname === 'localhost' ? 'http://localhost:8080/ipfs' : 'https://ipfs.eth.aragon.network/ipfs'
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"

function App() {
  const { api, network, appState, connectedAccount } = useAragonApi()
  const { count, airdrops = [], awarded, syncing } = appState

  const [names, setNames] = useState()
  useEffect(()=>{
    if(!api) return
    api.call('names').toPromise()
      .then(addr=>api.external(addr, NamesABI))
      .then(setNames)
  }, [api, network])

  const [name, setName] = useState()
  useEffect(()=>{
    if(!names) return
    names.nameOf(connectedAccount).toPromise()
      .then(setName)
  }, [names, connectedAccount])

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

  return (
    <Main>
      <AppView appBar={<AppBar title="Airdrop" endContent={<Button mode="strong" onClick={()=>setPanelOpen(true)}>New airdrop</Button>} />} >
        <h1>{name}</h1>
        <h1>{connectedAccount}</h1>
        <section>
          <Text size="xlarge">Ready to claim:</Text>
          <CardLayout columnWidthMin={30 * GU} rowHeight={294}>
            {detailed.filter(a=>(!a.awarded && a.userData)).map((d, i)=><Airdrop {...d} names={names} name={name} key={d.id} />)}
          </CardLayout>
        </section>
        <section>
          <Text size="xlarge">Archive:</Text>
          <CardLayout columnWidthMin={30 * GU} rowHeight={294}>
            {detailed.filter(a=>(a.awarded || !a.userData)).map((d, i)=><Airdrop {...d} names={names} name={name} key={d.id} />)}
          </CardLayout>
        </section>
      </AppView>
      <SidePanel title={"New Airdrop"} opened={panelOpen} onClose={()=>setPanelOpen(false)}>
        <Merklize />
      </SidePanel>
    </Main>
  )
}

function Merklize() {
  const [file, setFile] = useState()
  const [data, setData] = useState()

  useEffect(()=>{
    console.log("file", file)
    if(file){
      let reader = new FileReader()
      reader.onload = async (e)=>{
        let recipients = await csv().fromString(e.target.result)
        // console.log(recipients)
        let merklized = merklize(recipients, "username", "points")
        setData(merklized)
      }
      reader.readAsText(file)
    } else {
      console.log("no file")
      console.log("data", data)
      setData()
    }
  }, [file])

  return (
    <Field label="Load airdrop csv:">
      <input type="file" onChange={(e)=>{e.target.files && e.target.files.length && setFile(e.target.files[0])}} />
      <ValidationData data={data} />
      <Button onClick={()=>setFile()}>Clear</Button>
    </Field>
  )
}

function ValidationData({data}){
  const { api } = useAragonApi()

  const [hash, setHash] = useState()
  useEffect(()=>{
    if(!data) {
      setHash()
      return
    }
    (async function(){
      let ipfs = ipfsClient('/ip4/127.0.0.1/tcp/5001')
      let res = await ipfs.add(Buffer.from(JSON.stringify(data), 'utf8'))
      if(!res) return
      let hash = res[0].hash
      setHash(hash)
      await api.start(data.root, `ipfs:${hash}`).toPromise()
    })()
  }, [data])

  return (
    <React.Fragment>
      {data &&
        (hash ?
          <p>You're data with merkle root ({data.root}) and ipfs hash ({hash}) has been added to ipfs but may need to propagate through the network if it doesn't already appear <a href={`https://ipfs.eth.aragon.network/ipfs/${hash}`} target="_blank">here</a>.</p> :
          <p>no ipfs hash generated. missing local ipfs node?</p>
        )
      }
    </React.Fragment>
  )
}

function Airdrop({id, dataURI, data, awarded, userData, name, root}) {
  const { api, connectedAccount } = useAragonApi()

  const [opened, setOpened] = useState(false)

  return (
    <Card css={`
        display: grid;
        grid-template-columns: 100%;
        grid-template-rows: auto 1fr auto auto;
        grid-gap: ${1 * GU}px;
        padding: ${3 * GU}px;
    `}>
      <header style={{display: "flex", justifyContent: "space-between"}}>
        <Text color={theme.textTertiary}>#{id}</Text>
        <IconSettings color={theme.textTertiary} style={{"cursor":"pointer"}} onClick={()=>setOpened(true)}/>
      </header>
      <section>
        {!awarded && !data &&
          <Info.Alert style={{"margin-bottom": "10px"}}>Retrieving airdrop data...</Info.Alert>
        }
        {data && !userData &&
          <Info.Alert style={{"margin-bottom": "10px"}}>Nothing to claim for {name}</Info.Alert>
        }
        {!name &&
          <Info.Alert style={{"margin-bottom": "10px"}}>{connectedAccount.slice(0,8)}... has not registered</Info.Alert>
        }
        {awarded &&
          <Info style={{"margin-bottom": "10px"}}>You were awarded</Info>
        }
        {!awarded && userData &&
          <Info.Action style={{"margin-bottom": "10px"}}>You can claim <br/>{web3.toBigNumber(userData.amount).div("1e+18").toFixed()}</Info.Action>
        }
      </section>
      <footer style={{display: "flex", justifyContent: "flex-end"}}>
        {!awarded && userData &&
          <Button mode="strong" emphasis="positive" onClick={()=>api.award(id, name, userData.amount, userData.proof).toPromise()}>Claim</Button>
        }
      </footer>
      <Modal visible={opened} onClose={()=>setOpened(false)}>
        {data && <Button onClick={()=>awardToMany(api, names, id, data)}>Award Many</Button>}
        <Button onClick={() => setOpened(false)}>Close</Button>
      </Modal>
    </Card>
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

export default App
