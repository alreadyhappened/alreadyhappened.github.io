import { useMemo, useState } from 'react'
import { post } from './api'
import CastleMap from './components/CastleMap'
import IntroSequence from './components/IntroSequence'
import MorningReveal from './components/MorningReveal'
import HostDialogue from './components/HostDialogue'
import PhaseControls from './components/PhaseControls'
import EndgameVote from './components/EndgameVote'
const SPEECH_DELAY_MS = 920
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function alivePlayers(state) {
  if (!state?.players) return []
  return state.players.filter(p => p.alive)
}

function aliveAIs(state) {
  return alivePlayers(state).filter(p => !p.isHuman)
}

export default function App() {
  // Setup
  const [name, setName] = useState('')
  const [started, setStarted] = useState(false)

  // Game state from backend
  const [gameState, setGameState] = useState(null)
  const [sessionId, setSessionId] = useState('')

  // Visual phase (frontend sub-phases on top of backend phases)
  const [visualPhase, setVisualPhase] = useState('setup')

  // UI state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState([])
  const [hostText, setHostText] = useState('')
  const [lastMurdered, setLastMurdered] = useState(null)
  const [activeSpeech, setActiveSpeech] = useState(null)

  // Endgame state
  const [endgameChoices, setEndgameChoices] = useState(null)
  const [endgameOutcome, setEndgameOutcome] = useState(null)

  // Input state
  const [dayLine, setDayLine] = useState('')
  const [parlorLine, setParlorLine] = useState('')
  const [roundtableLine, setRoundtableLine] = useState('')
  const [voteTarget, setVoteTarget] = useState('')
  const [nightTarget, setNightTarget] = useState('')

  const alive = useMemo(() => alivePlayers(gameState), [gameState])
  const aliveAi = useMemo(() => aliveAIs(gameState), [gameState])

  function prettyLabel(label) {
    const raw = String(label || '').trim()
    if (!raw) return ''
    if (raw.toLowerCase() === 'you') return 'You'
    if (raw.toLowerCase() === 'host') return 'Host'
    if (raw.toLowerCase() === 'banished') return 'Banished'
    if (raw.toLowerCase() === 'turret') return 'Turret'
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  function appendLog(label, text) {
    if (!text) return
    setLog(prev => [...prev, { label: prettyLabel(label), text }])
  }

  async function speakSequential(lines, formatter) {
    for (const line of lines || []) {
      const text = formatter ? formatter(line) : line?.statement || ''
      if (!text) continue
      appendLog(line.name || line.id || 'player', text)
      if (line.id) setActiveSpeech({ playerId: line.id, text })
      await sleep(SPEECH_DELAY_MS)
    }
    setActiveSpeech(null)
  }

  function syncTargets(state) {
    const ai = aliveAIs(state)
    if (ai.length) {
      setVoteTarget(cur => ai.some(p => p.id === cur) ? cur : ai[0].id)
      setNightTarget(cur => ai.some(p => p.id === cur) ? cur : ai[0].id)
    }
  }

  async function openDayPhase() {
    if (!sessionId || busy) return
    setBusy(true)
    setError('')
    setVisualPhase('day')
    try {
      const data = await post('/traitors/day-open', { session_id: sessionId })
      setGameState(data.state)
      syncTargets(data.state)
      await speakSequential(data.ai_turns || [], (t) => t.statement || '')
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function openRoundtablePhase() {
    if (!sessionId || busy) return
    setBusy(true)
    setError('')
    setVisualPhase('roundtable')
    try {
      const data = await post('/traitors/roundtable-open', { session_id: sessionId })
      setGameState(data.state)
      syncTargets(data.state)
      await speakSequential(data.ai_turns || [], (t) => t.statement || '')
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function openParlorPhase() {
    if (!sessionId || busy) return
    setBusy(true)
    setError('')
    setVisualPhase('parlor')
    try {
      const data = await post('/traitors/parlor-open', { session_id: sessionId })
      setGameState(data.state)
      syncTargets(data.state)
      await speakSequential(data.ai_turns || [], (t) => t.statement || '')
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  // === GAME ACTIONS ===

  async function startGame() {
    if (!name.trim()) {
      setError('Enter your name first.')
      return
    }
    setBusy(true)
    setError('')
    setLog([])
    try {
      const data = await post('/traitors/start', { human_name: name.trim(), ai_count: 6 })
      setGameState(data.state)
      setSessionId(data.session_id || '')
      setStarted(true)
      syncTargets(data.state)
      setVisualPhase('intro')
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  function finishIntro() {
    openDayPhase()
    setHostText('')
  }

  function finishMorningReveal() {
    openDayPhase()
    setHostText('')
  }

  async function runDay(opts = {}) {
    if (!gameState || busy) return
    const silent = !!opts.silent
    const spoken = dayLine.trim()
    const dayStatement = silent ? '[SILENT_AT_BREAKFAST]' : spoken
    setBusy(true)
    setError('')
    if (silent) {
      appendLog('you', 'You say nothing and study the room.')
      setActiveSpeech({ playerId: 'human', text: '...I stay quiet for now.' })
      await sleep(560)
      setActiveSpeech(null)
    } else if (spoken) {
      appendLog('you', spoken)
      setActiveSpeech({ playerId: 'human', text: spoken })
      await sleep(560)
      setActiveSpeech(null)
    }
    let shouldOpenParlor = false
    try {
      const data = await post('/traitors/day', {
        session_id: sessionId,
        human_day_statement: dayStatement,
      })
      setGameState(data.state)
      syncTargets(data.state)
      await speakSequential(data.ai_turns || [], (t) => t.statement || '')
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }
      setDayLine('')
      shouldOpenParlor = true
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
    if (shouldOpenParlor) {
      await openParlorPhase()
    }
  }

  async function runParlor(opts = {}) {
    if (!gameState || busy) return
    const silent = !!opts.silent
    const spoken = parlorLine.trim()
    const parlorStatement = silent ? '[SILENT_AT_PARLOR]' : spoken
    setBusy(true)
    setError('')
    if (silent) {
      appendLog('you', 'You keep your cards close in the private chat.')
      setActiveSpeech({ playerId: 'human', text: '...I stay guarded.' })
      await sleep(560)
      setActiveSpeech(null)
    } else if (spoken) {
      appendLog('you', spoken)
      setActiveSpeech({ playerId: 'human', text: spoken })
      await sleep(560)
      setActiveSpeech(null)
    }
    let shouldOpenRoundtable = false
    try {
      const data = await post('/traitors/parlor-turn', {
        session_id: sessionId,
        human_parlor_statement: parlorStatement,
      })
      setGameState(data.state)
      syncTargets(data.state)
      await speakSequential(data.ai_turns || [], (t) => t.statement || '')
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }
      setParlorLine('')
      shouldOpenRoundtable = true
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
    if (shouldOpenRoundtable) {
      await openRoundtablePhase()
    }
  }

  async function runRoundtable(opts = {}) {
    if (!gameState || busy) return
    const silent = !!opts.silent
    const spoken = roundtableLine.trim()
    const roundtableStatement = silent ? '[SILENT_AT_ROUNDTABLE]' : spoken
    setBusy(true)
    setError('')
    if (silent) {
      appendLog('you', 'You stay silent at the Round Table.')
      setActiveSpeech({ playerId: 'human', text: '...I hold my tongue.' })
      await sleep(560)
      setActiveSpeech(null)
    } else if (spoken) {
      appendLog('you', spoken)
      setActiveSpeech({ playerId: 'human', text: spoken })
      await sleep(560)
      setActiveSpeech(null)
    }
    try {
      const data = await post('/traitors/roundtable', {
        session_id: sessionId,
        human_statement: roundtableStatement,
      })
      setGameState(data.state)
      syncTargets(data.state)
      await speakSequential(data.ai_turns || [], (t) => t.statement || '')
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }
      setRoundtableLine('')
      setVisualPhase('vote')
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function runVote() {
    if (!gameState || busy) return
    setBusy(true)
    setError('')
    try {
      const data = await post('/traitors/vote', {
        session_id: sessionId,
        human_vote: voteTarget,
      })
      setGameState(data.state)
      syncTargets(data.state)

      const nameById = new Map((data.state?.players || []).map((p) => [p.id, p.name]))
      await speakSequential(
        data.ai_votes || [],
        (v) => `votes to banish ${nameById.get(v.vote) || v.vote}. ${v.reason || ''}`.trim()
      )
      if (data.banished) {
        appendLog('banished', `${data.banished.name} was banished. They were ${data.banished.role}.`)
      }
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }

      // Determine next visual phase
      const nextPhase = data.state?.phase
      if (nextPhase === 'ended') {
        setVisualPhase('ended')
        const win = data.state.winner === 'human'
        appendLog('host', win ? 'You reached the final two. Traitor wins.' : 'The Faithful banished you. AI wins.')
        setHostText(win ? 'You reached the final two. Traitor wins.' : 'The Faithful banished you. AI wins.')
      } else if (nextPhase === 'endgame_choice') {
        setVisualPhase('endgame_choice')
      } else {
        // Normal flow: go to night
        setVisualPhase('night')
      }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function runNight() {
    if (!gameState || busy) return
    setBusy(true)
    setError('')
    try {
      const data = await post('/traitors/night', {
        session_id: sessionId,
        murder_target: nightTarget,
      })
      setGameState(data.state)
      syncTargets(data.state)

      if (data.murdered) {
        appendLog('turret', `You murdered ${data.murdered.name}.`)
        setLastMurdered(data.murdered)
      }
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }

      const nextPhase = data.state?.phase
      if (nextPhase === 'ended') {
        setVisualPhase('ended')
        const win = data.state.winner === 'human'
        appendLog('host', win ? 'You reached the final two. Traitor wins.' : 'The Faithful banished you. AI wins.')
        setHostText(win ? 'You reached the final two. Traitor wins.' : 'The Faithful banished you. AI wins.')
      } else {
        // Morning reveal before next day
        setVisualPhase('morningReveal')
      }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function runEndgameChoice(choice) {
    if (!gameState || busy) return
    setBusy(true)
    setError('')
    try {
      const data = await post('/traitors/endgame-vote', {
        session_id: sessionId,
        human_choice: choice,
      })
      setGameState(data.state)
      syncTargets(data.state)

      if (data.ai_choices) {
        setEndgameChoices(data.ai_choices)
        data.ai_choices.forEach(c =>
          appendLog(c.name, `chose: ${c.choice === 'end' ? 'End Game' : 'Banish Again'}. ${c.reason || ''}`.trim())
        )
      }
      setEndgameOutcome(data.outcome)
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }

      const nextPhase = data.state?.phase
      if (nextPhase === 'ended') {
        setVisualPhase('ended')
        const win = data.state.winner === 'human'
        appendLog('host', win ? 'You reached the final two. Traitor wins.' : 'The Faithful banished you. AI wins.')
        setHostText(win ? 'You reached the final two. Traitor wins.' : 'The Faithful banished you. AI wins.')
      } else {
        // Back to roundtable for another banishment
        setVisualPhase('roundtable')
        setEndgameChoices(null)
        setEndgameOutcome(null)
      }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  function resetGame() {
    setGameState(null)
    setStarted(false)
    setSessionId('')
    setVisualPhase('setup')
    setLog([])
    setError('')
    setHostText('')
    setLastMurdered(null)
    setActiveSpeech(null)
    setEndgameChoices(null)
    setEndgameOutcome(null)
    setDayLine('')
    setParlorLine('')
    setRoundtableLine('')
    setVoteTarget('')
    setNightTarget('')
  }

  // === RENDER ===

  return (
    <div className="app">
      <header className="header">
        <h1>The Traitors</h1>
        <p className="subtitle">AI Edition</p>
        <a className="back-link" href="/experiments.html">&larr; experiments</a>
      </header>

      {/* Setup screen */}
      {visualPhase === 'setup' && (
        <div className="setup">
          <div className="setup-inner">
            <p className="setup-text">
              You are the Traitor in a castle full of AI Faithful.<br />
              Survive banishment and reach the final two to win.
            </p>
            <div className="setup-form">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                onKeyDown={e => e.key === 'Enter' && startGame()}
                disabled={busy}
              />
              <button onClick={startGame} disabled={busy || !name.trim()}>
                {busy ? 'Starting...' : 'Enter the castle'}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </div>
        </div>
      )}

      {/* Intro sequence */}
      {visualPhase === 'intro' && started && (
        <div className="intro-stage">
          <IntroSequence playerName={name} onComplete={finishIntro} />
        </div>
      )}

      {/* Main game */}
      {started && visualPhase !== 'setup' && visualPhase !== 'intro' && (
        <div className="game-area">
          <div className="phase-badge">
            {visualPhase === 'day' && `Round ${gameState?.round || 1} — Breakfast & Day`}
            {visualPhase === 'parlor' && `Round ${gameState?.round || 1} — Private Conversation`}
            {visualPhase === 'morningReveal' && `Round ${gameState?.round || 1} — Morning`}
            {visualPhase === 'roundtable' && `Round ${gameState?.round || 1} — Round Table`}
            {visualPhase === 'vote' && `Round ${gameState?.round || 1} — Banishment Vote`}
            {visualPhase === 'night' && `Round ${gameState?.round || 1} — The Turret`}
            {visualPhase === 'endgame_choice' && 'Endgame — The Final Choice'}
            {visualPhase === 'ended' && 'Game Over'}
          </div>

          <CastleMap
            players={gameState?.players || []}
            phase={visualPhase}
            lastMurdered={lastMurdered}
            activeSpeech={activeSpeech}
            parlorPartnerId={gameState?.parlorPartnerId || ''}
          />

          {/* Morning reveal overlay */}
          {visualPhase === 'morningReveal' && lastMurdered && (
            <MorningReveal
              murdered={lastMurdered}
              onContinue={finishMorningReveal}
            />
          )}

          {/* Host dialogue (not during intro or morning reveal which have their own) */}
          {visualPhase !== 'morningReveal' && hostText && visualPhase !== 'ended' && (
            <HostDialogue
              text={hostText}
              onContinue={() => setHostText('')}
              showContinue={!busy}
            />
          )}

          {/* Endgame vote results */}
          {endgameChoices && (
            <EndgameVote
              aiChoices={endgameChoices}
              outcome={endgameOutcome}
              busy={busy}
            />
          )}

          {/* Controls */}
          {visualPhase !== 'intro' && (
            <PhaseControls
              phase={visualPhase}
              busy={busy}
              alivePlayers={alive}
              dayLine={dayLine}
              setDayLine={setDayLine}
            onRunDay={runDay}
            onRunDaySilent={() => runDay({ silent: true })}
              roundtableLine={roundtableLine}
              setRoundtableLine={setRoundtableLine}
              onRunRoundtable={runRoundtable}
              onRunRoundtableSilent={() => runRoundtable({ silent: true })}
              parlorLine={parlorLine}
              setParlorLine={setParlorLine}
              onRunParlor={runParlor}
              onRunParlorSilent={() => runParlor({ silent: true })}
              voteTarget={voteTarget}
              setVoteTarget={setVoteTarget}
              onRunVote={runVote}
              nightTarget={nightTarget}
              setNightTarget={setNightTarget}
              onRunNight={runNight}
              onEndgameChoice={runEndgameChoice}
              winner={gameState?.winner}
            />
          )}

          {/* Reset */}
          {started && (
            <button className="reset-btn" onClick={resetGame} disabled={busy}>
              Reset game
            </button>
          )}

          {error && <div className="error">{error}</div>}
        </div>
      )}
    </div>
  )
}
