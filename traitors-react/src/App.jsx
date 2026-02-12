import { useMemo, useState } from 'react'

const WORKER_URL = 'https://stefan-chatbot.stefankelly.workers.dev'

function parseError(e) {
  if (e instanceof Error) return e.message
  return String(e)
}

async function post(path, payload) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
  return data
}

function alivePlayers(state) {
  if (!state || !Array.isArray(state.players)) return []
  return state.players.filter((p) => p.alive)
}

function aliveAIs(state) {
  return alivePlayers(state).filter((p) => !p.isHuman)
}

function PhaseBadge({ phase, round }) {
  const text = (() => {
    if (!phase) return 'Setup'
    if (phase === 'day') return `Round ${round} · Day`
    if (phase === 'roundtable') return `Round ${round} · Roundtable`
    if (phase === 'vote') return `Round ${round} · Vote`
    if (phase === 'night') return `Round ${round} · Turret`
    if (phase === 'ended') return 'Endgame'
    return phase
  })()
  return <div className="phase-badge">{text}</div>
}

function Roundtable({ players }) {
  if (!players?.length) {
    return (
      <div className="scene">
        <div className="table" />
      </div>
    )
  }

  return (
    <div className="scene">
      <div className="table" />
      {players.map((p, i) => {
        const angle = (i * 360) / players.length
        return (
          <div
            key={p.id}
            className={`seat ${p.isHuman ? 'human' : ''} ${p.alive ? '' : 'dead'}`}
            style={{ '--angle': `${angle}deg` }}
          >
            {p.name}
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const [name, setName] = useState('')
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dayLine, setDayLine] = useState('')
  const [roundtableLine, setRoundtableLine] = useState('')
  const [voteTarget, setVoteTarget] = useState('')
  const [nightTarget, setNightTarget] = useState('')
  const [log, setLog] = useState([])
  const [error, setError] = useState('')

  const started = !!state
  const phase = state?.phase || 'setup'
  const aliveAi = useMemo(() => aliveAIs(state), [state])

  function append(label, text) {
    if (!text) return
    setLog((prev) => [...prev, { label, text }])
  }

  function syncTargets(nextState) {
    const ai = aliveAIs(nextState)
    if (ai.length) {
      setVoteTarget((cur) => (ai.some((p) => p.id === cur) ? cur : ai[0].id))
      setNightTarget((cur) => (ai.some((p) => p.id === cur) ? cur : ai[0].id))
    } else {
      setVoteTarget('')
      setNightTarget('')
    }
  }

  async function startGame() {
    if (!name.trim()) {
      setError('Enter your name first.')
      return
    }
    setBusy(true)
    setError('')
    setLog([])
    try {
      const data = await post('/traitors/start', { human_name: name.trim(), ai_count: 7 })
      setState(data.state)
      syncTargets(data.state)
      append('host', data.host_line || 'The game begins.')
    } catch (e) {
      setError(parseError(e))
    }
    setBusy(false)
  }

  async function runDay() {
    if (!state || phase !== 'day') return
    setBusy(true)
    setError('')
    if (dayLine.trim()) append('you', dayLine.trim())
    try {
      const data = await post('/traitors/day', { state, human_day_statement: dayLine.trim() })
      setState(data.state)
      syncTargets(data.state)
      ;(data.ai_turns || []).forEach((t) => append(t.name || t.id, t.statement || ''))
      append('host', data.host_line || '')
      setDayLine('')
    } catch (e) {
      setError(parseError(e))
    }
    setBusy(false)
  }

  async function runRoundtable() {
    if (!state || phase !== 'roundtable') return
    setBusy(true)
    setError('')
    if (roundtableLine.trim()) append('you', roundtableLine.trim())
    try {
      const data = await post('/traitors/roundtable', { state, human_statement: roundtableLine.trim() })
      setState(data.state)
      syncTargets(data.state)
      ;(data.ai_turns || []).forEach((t) => append(t.name || t.id, t.statement || ''))
      append('host', data.host_line || '')
      setRoundtableLine('')
    } catch (e) {
      setError(parseError(e))
    }
    setBusy(false)
  }

  async function runVote() {
    if (!state || phase !== 'vote') return
    setBusy(true)
    setError('')
    try {
      const data = await post('/traitors/vote', { state, human_vote: voteTarget })
      setState(data.state)
      syncTargets(data.state)
      ;(data.ai_votes || []).forEach((v) => append(`${v.name} vote`, `${v.name} votes ${v.vote}. ${v.reason || ''}`.trim()))
      if (data.banished) append('banished', `${data.banished.name} was banished (${data.banished.role}).`)
      append('host', data.host_line || '')
      if (data.state?.phase === 'ended') {
        append('host', data.state?.winner === 'human' ? 'You reached final two. Traitor win.' : 'The Faithful banished you. AI win.')
      }
    } catch (e) {
      setError(parseError(e))
    }
    setBusy(false)
  }

  async function runNight() {
    if (!state || phase !== 'night') return
    setBusy(true)
    setError('')
    try {
      const data = await post('/traitors/night', { state, murder_target: nightTarget })
      setState(data.state)
      syncTargets(data.state)
      if (data.murdered) append('turret', `You murdered ${data.murdered.name}.`)
      append('host', data.host_line || '')
      if (data.state?.phase === 'ended') {
        append('host', data.state?.winner === 'human' ? 'You reached final two. Traitor win.' : 'The Faithful banished you. AI win.')
      }
    } catch (e) {
      setError(parseError(e))
    }
    setBusy(false)
  }

  function resetGame() {
    setState(null)
    setLog([])
    setError('')
    setDayLine('')
    setRoundtableLine('')
    setVoteTarget('')
    setNightTarget('')
  }

  return (
    <div className="app">
      <header className="top">
        <h1>The Traitors (AI Edition)</h1>
        <p>You are the Traitor. Survive to final two to win. AIs are trying to identify and banish the one non-AI player.</p>
        <a className="back-link" href="/experiments.html">Back to experiments</a>
      </header>

      <div className="layout">
        <section>
          <PhaseBadge phase={phase} round={state?.round || 1} />
          <Roundtable players={state?.players || []} />

          <div className="log">
            {log.map((item, idx) => (
              <div className="line" key={`${item.label}-${idx}`}>
                <div className="label">{item.label}</div>
                <div>{item.text}</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="controls">
          <button onClick={startGame} disabled={busy || started}>Start game</button>
          <button onClick={resetGame} disabled={busy || !started}>Reset game</button>

          {!started && (
            <div className="step">
              <label>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
            </div>
          )}

          {started && phase === 'day' && (
            <div className="step">
              <label>Day conversation line</label>
              <textarea value={dayLine} onChange={(e) => setDayLine(e.target.value)} placeholder="Blend in. Subtly redirect suspicion." />
              <button onClick={runDay} disabled={busy}>Run day conversation</button>
            </div>
          )}

          {started && phase === 'roundtable' && (
            <div className="step">
              <label>Roundtable statement</label>
              <textarea value={roundtableLine} onChange={(e) => setRoundtableLine(e.target.value)} placeholder="Accuse someone else of being the human." />
              <button onClick={runRoundtable} disabled={busy}>Run roundtable</button>
            </div>
          )}

          {started && phase === 'vote' && (
            <div className="step">
              <label>Your vote target</label>
              <select value={voteTarget} onChange={(e) => setVoteTarget(e.target.value)}>
                {aliveAi.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={runVote} disabled={busy || !voteTarget}>Run vote</button>
            </div>
          )}

          {started && phase === 'night' && (
            <div className="step">
              <label>Turret murder target</label>
              <select value={nightTarget} onChange={(e) => setNightTarget(e.target.value)}>
                {aliveAi.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={runNight} disabled={busy || !nightTarget}>Commit murder</button>
            </div>
          )}

          {started && phase === 'ended' && (
            <div className="step end">
              {state?.winner === 'human' ? 'You reached final two. Traitor win.' : 'The Faithful banished you. AI win.'}
            </div>
          )}

          {error && <div className="error">{error}</div>}
        </aside>
      </div>
    </div>
  )
}
