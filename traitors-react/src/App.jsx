import { useMemo, useState } from 'react'
import { post } from './api'
import CastleMap from './components/CastleMap'
import IntroSequence from './components/IntroSequence'
import MorningReveal from './components/MorningReveal'
import HostDialogue from './components/HostDialogue'
import PhaseControls from './components/PhaseControls'
import EventLog from './components/EventLog'
import EndgameVote from './components/EndgameVote'
import BreakfastPrelude from './components/BreakfastPrelude'

function alivePlayers(state) {
  if (!state?.players) return []
  return state.players.filter(p => p.alive)
}

function aliveAIs(state) {
  return alivePlayers(state).filter(p => !p.isHuman)
}

function buildBreakfastPrelude(state) {
  const ai = aliveAIs(state)
  if (ai.length < 3) return []
  const picks = ai.slice(0, Math.min(5, ai.length))
  return [
    {
      speaker: picks[0].name,
      text: `I keep coming back to behaviour under pressure. Someone is over-managing their answers.`,
    },
    {
      speaker: picks[1]?.name || picks[0].name,
      text: `Agreed. Identity claims are noise. I care more about consistency between breakfast and the Round Table.`,
    },
    {
      speaker: picks[2]?.name || picks[0].name,
      text: `Let's cross-check details later. If someone pivots too cleanly, that's probably our human.`,
    },
  ]
}

export default function App() {
  // Setup
  const [name, setName] = useState('')
  const [started, setStarted] = useState(false)

  // Game state from backend
  const [gameState, setGameState] = useState(null)

  // Visual phase (frontend sub-phases on top of backend phases)
  const [visualPhase, setVisualPhase] = useState('setup')

  // UI state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState([])
  const [hostText, setHostText] = useState('')
  const [lastMurdered, setLastMurdered] = useState(null)
  const [dayPreludeLines, setDayPreludeLines] = useState([])

  // Endgame state
  const [endgameChoices, setEndgameChoices] = useState(null)
  const [endgameOutcome, setEndgameOutcome] = useState(null)

  // Input state
  const [dayLine, setDayLine] = useState('')
  const [roundtableLine, setRoundtableLine] = useState('')
  const [voteTarget, setVoteTarget] = useState('')
  const [nightTarget, setNightTarget] = useState('')

  const alive = useMemo(() => alivePlayers(gameState), [gameState])
  const aliveAi = useMemo(() => aliveAIs(gameState), [gameState])

  function appendLog(label, text) {
    if (!text) return
    setLog(prev => [...prev, { label, text }])
  }

  function syncTargets(state) {
    const ai = aliveAIs(state)
    if (ai.length) {
      setVoteTarget(cur => ai.some(p => p.id === cur) ? cur : ai[0].id)
      setNightTarget(cur => ai.some(p => p.id === cur) ? cur : ai[0].id)
    }
  }

  function startDayPrelude(nextState) {
    setDayPreludeLines(buildBreakfastPrelude(nextState))
    setVisualPhase('dayPrelude')
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
      const data = await post('/traitors/start', { human_name: name.trim(), ai_count: 7 })
      setGameState(data.state)
      setStarted(true)
      syncTargets(data.state)
      setVisualPhase('intro')
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  function finishIntro() {
    startDayPrelude(gameState)
    setHostText('')
  }

  function finishMorningReveal() {
    startDayPrelude(gameState)
    setHostText('')
  }

  function finishDayPrelude() {
    setVisualPhase('day')
  }

  async function runDay() {
    if (!gameState || busy) return
    setBusy(true)
    setError('')
    if (dayLine.trim()) appendLog('you', dayLine.trim())
    try {
      const data = await post('/traitors/day', {
        state: gameState,
        human_day_statement: dayLine.trim(),
      })
      setGameState(data.state)
      syncTargets(data.state)
      ;(data.ai_turns || []).forEach(t => appendLog(t.name || t.id, t.statement || ''))
      if (data.host_line) {
        appendLog('host', data.host_line)
        setHostText(data.host_line)
      }
      setDayLine('')
      setVisualPhase('roundtable')
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function runRoundtable() {
    if (!gameState || busy) return
    setBusy(true)
    setError('')
    if (roundtableLine.trim()) appendLog('you', roundtableLine.trim())
    try {
      const data = await post('/traitors/roundtable', {
        state: gameState,
        human_statement: roundtableLine.trim(),
      })
      setGameState(data.state)
      syncTargets(data.state)
      ;(data.ai_turns || []).forEach(t => appendLog(t.name || t.id, t.statement || ''))
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
        state: gameState,
        human_vote: voteTarget,
      })
      setGameState(data.state)
      syncTargets(data.state)

      // Log votes
      ;(data.ai_votes || []).forEach(v =>
        appendLog(`${v.name}`, `votes to banish ${v.vote}. ${v.reason || ''}`.trim())
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
        state: gameState,
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
        state: gameState,
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
    setVisualPhase('setup')
    setLog([])
    setError('')
    setHostText('')
    setLastMurdered(null)
    setDayPreludeLines([])
    setEndgameChoices(null)
    setEndgameOutcome(null)
    setDayLine('')
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
            {visualPhase === 'dayPrelude' && `Round ${gameState?.round || 1} — Breakfast`}
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

          {visualPhase === 'dayPrelude' && (
            <BreakfastPrelude
              lines={dayPreludeLines}
              onContinue={finishDayPrelude}
              busy={busy}
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
          {visualPhase !== 'dayPrelude' && (
            <PhaseControls
              phase={visualPhase}
              busy={busy}
              alivePlayers={alive}
              dayLine={dayLine}
              setDayLine={setDayLine}
              onRunDay={runDay}
              roundtableLine={roundtableLine}
              setRoundtableLine={setRoundtableLine}
              onRunRoundtable={runRoundtable}
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

          {/* Event log */}
          <EventLog entries={log} />

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
