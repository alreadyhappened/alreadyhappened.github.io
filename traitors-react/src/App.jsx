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
    if (phase === 'day') return `Round ${round} · Breakfast and day`
    if (phase === 'roundtable') return `Round ${round} · Round Table`
    if (phase === 'vote') return `Round ${round} · Banishment vote`
    if (phase === 'night') return `Round ${round} · Traitors' Turret`
    if (phase === 'ended') return 'Endgame'
    return phase
  })()
  return <div className="phase-badge">{text}</div>
}

function Roundtable({ players, phase, flashTick, flashKind }) {
  const roomActive = {
    day: 'day',
    roundtable: 'roundtable',
    vote: 'vote',
    night: 'night',
  }[phase]

  const roomStrip = (
    <div className="room-strip" aria-label="Castle locations">
      <div className={`room ${roomActive === 'day' ? 'active' : ''}`}>Breakfast Hall</div>
      <div className={`room ${roomActive === 'roundtable' ? 'active' : ''}`}>Round Table</div>
      <div className={`room ${roomActive === 'vote' ? 'active' : ''}`}>Banishment</div>
      <div className={`room ${roomActive === 'night' ? 'active' : ''}`}>Turret</div>
    </div>
  )

  if (!players?.length) {
    return (
      <div className="scene-wrap">
        {roomStrip}
        <div className={`scene ${phase || 'setup'}`}>
          <div className="table" />
        </div>
      </div>
    )
  }

  return (
    <div className="scene-wrap">
      {roomStrip}
      <div className={`scene ${phase || 'setup'}`}>
        <div className="table" />
        <div
          key={`${flashKind}-${flashTick}`}
          className={`flash-layer ${flashTick ? 'active' : ''} ${flashKind || 'banishment'}`}
          aria-hidden="true"
        />
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
  const [flashTick, setFlashTick] = useState(0)
  const [flashKind, setFlashKind] = useState('banishment')

  const started = !!state
  const phase = state?.phase || 'setup'
  const aliveAi = useMemo(() => aliveAIs(state), [state])

  function append(label, text) {
    if (!text) return
    setLog((prev) => [...prev, { label, text }])
  }

  function triggerFlash(kind) {
    setFlashKind(kind === 'night' ? 'night' : 'banishment')
    setFlashTick((v) => v + 1)
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
      if (data.banished) {
        append('banished', `${data.banished.name} was banished (${data.banished.role}).`)
        triggerFlash('banishment')
      }
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
      if (data.murdered) {
        append('turret', `You murdered ${data.murdered.name}.`)
        triggerFlash('night')
      }
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
    setFlashTick(0)
    setFlashKind('banishment')
  }

  return (
    <div className="app">
      <header className="top">
        <h1>The Traitors (UK AI Edition)</h1>
        <p>Claudia hosts. You are the secret Traitor in a castle full of AI Faithful. Survive banishment and reach the final two to win.</p>
        <a className="back-link" href="/experiments.html">Back to experiments</a>
      </header>

      <div className="layout">
        <section>
          <PhaseBadge phase={phase} round={state?.round || 1} />
          <Roundtable
            players={state?.players || []}
            phase={phase}
            flashTick={flashTick}
            flashKind={flashKind}
          />

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
              <label>Your breakfast/daytime line</label>
              <textarea value={dayLine} onChange={(e) => setDayLine(e.target.value)} placeholder="At breakfast and through the day, sell your Faithful story." />
              <button onClick={runDay} disabled={busy}>Run breakfast and day</button>
            </div>
          )}

          {started && phase === 'roundtable' && (
            <div className="step">
              <label>Your Round Table accusation/defence</label>
              <textarea value={roundtableLine} onChange={(e) => setRoundtableLine(e.target.value)} placeholder="At the Round Table, push suspicion onto another player." />
              <button onClick={runRoundtable} disabled={busy}>Run Round Table</button>
            </div>
          )}

          {started && phase === 'vote' && (
            <div className="step">
              <label>Your banishment vote (Round Table)</label>
              <select value={voteTarget} onChange={(e) => setVoteTarget(e.target.value)}>
                {aliveAi.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={runVote} disabled={busy || !voteTarget}>Run banishment vote</button>
            </div>
          )}

          {started && phase === 'night' && (
            <div className="step">
              <label>Traitors' Turret murder target</label>
              <select value={nightTarget} onChange={(e) => setNightTarget(e.target.value)}>
                {aliveAi.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={runNight} disabled={busy || !nightTarget}>Run Turret night</button>
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
