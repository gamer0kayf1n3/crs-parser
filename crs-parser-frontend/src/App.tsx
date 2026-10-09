import './App.css'
import { useState, useRef } from 'react'
import { parseSchedule, toTSV } from "./parseSchedule"

function App() {
  var [cont, setCont] = useState<string>("")
  var [name, setName] = useState<string>("")
  var [sem, setSem] = useState<number>(0)
  var copyRef = useRef<HTMLTextAreaElement>(null)

  function handleContChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setCont(event.target.value)
  }
  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    setName(event.target.value)
  }

  function handleSemChange(event: React.ChangeEvent<HTMLInputElement>) {

    setSem(Number(event.target.value))
  }
  function handleCopy() {
    navigator.clipboard.writeText(toTSV(parseSchedule(cont, name, sem)))
    if (copyRef.current) {
      copyRef.current.select()
      copyRef.current.setSelectionRange(0, 99999)
    }
  }
  return <div className="app-shell">
    <div className="main">
      <h1>Some CRS Parser</h1>
      <p>Paste your CRS table here.</p>
      <div className="inputs">
        <input className="n" placeholder="Your nickname (in the sheet)" type="text" onChange={handleNameChange}></input>
        <input className="s" placeholder="Sem" type="number" min="1" max="3" onChange={handleSemChange}></input>
      </div>
      <textarea placeholder="Paste your CRS table here" rows={10} cols={50} onChange={handleContChange} ref={copyRef}></textarea>
      {cont && <div className="shell">
        <pre>{
          toTSV(parseSchedule(cont, name, sem))
        }</pre>
        <button onClick={handleCopy}>Copy to clipboard</button>
      </div>}
      <p className="footer">For internal use of Straight Up Not Straight (SUNS) Group. All rights reserved. gamer0kayf1n3 (C)</p>
    </div>
  </div>
}

export default App
