import { useMemo, useReducer, useState } from 'react'
import { post } from './api'
import CastleMap from './components/CastleMap'
import IntroSequence from './components/IntroSequence'
import HostDialogue from './components/HostDialogue'

function mapSceneToPhase(scene) {
  if (scene === 'DAY_PARLOR_OPEN' || scene === 'DAY_PARLOR_PLAYER_TURN') return 'parlor'
  if (scene === 'ROUNDTABLE_OPEN' || scene === 'ROUNDTABLE_PLAYER_TURN') return 'roundtable'
  if (scene === 'VOTE_PROMPT' || scene === 'VOTE_REVEAL') return 'vote'
  if (scene === 'TURRET_PROMPT') return 'night'
  if (scene === 'MORNING_REVEAL') return 'morningReveal'
  if (scene === 'ENDED') return 'ended'
  return 'day'
}

const initialEngine = {
  started: false,
  sessionId: '',
  scene: 'setup',
  turnState: 'READY_TO_ADVANCE',
  queue: [],
  queueIndex: 0,
  currentItem: null,
  awaitingPlayerInput: false,
  playerInputKind: null,
  pendingAction: null,
  allowedActions: [],
  players: [],
  meta: { round: 1, alive_count: 0, winner: null },
  parlorPartnerId: '',
  error: '',
}

function engineReducer(state, action) {
  if (action.type === 'hydrate') {
    const p = action.payload || {}
    return {
      ...state,
      started: true,
      scene: p.scene || state.scene,
      turnState: p.turn_state || state.turnState,
      queue: Array.isArray(p.queue) ? p.queue : [],
      queueIndex: Number.isFinite(p.queue_index) ? p.queue_index : 0,
      currentItem: p.current_item || null,
      awaitingPlayerInput: !!p.awaiting_player_input,
      playerInputKind: p.player_input_kind || null,
      pendingAction: p.pending_action || null,
      allowedActions: Array.isArray(p.allowed_actions) ? p.allowed_actions : [],
      players: Array.isArray(p.players_public) ? p.players_public : [],
      meta: p.meta || state.meta,
      parlorPartnerId: p.meta?.parlor_partner_id || '',
      error: '',
    }
  }
  if (action.type === 'session') {
    return { ...state, sessionId: action.sessionId || state.sessionId }
  }
  if (action.type === 'error') {
    return { ...state, error: action.error || 'Unknown error' }
  }
  if (action.type === 'reset') {
    return { ...initialEngine }
  }
  return state
}

export default function App() {
  const [name, setName] = useState('')
  const [showIntro, setShowIntro] = useState(false)
  const [busy, setBusy] = useState(false)

  const [dayInput, setDayInput] = useState('')
  const [parlorInput, setParlorInput] = useState('')
  const [roundtableInput, setRoundtableInput] = useState('')
  const [voteTarget, setVoteTarget] = useState('')
  const [murderTarget, setMurderTarget] = useState('')

  const [engine, dispatch] = useReducer(engineReducer, initialEngine)

  const phase = useMemo(() => mapSceneToPhase(engine.scene), [engine.scene])
  const current = engine.currentItem

  const activeSpeech = useMemo(() => {
    if (!current) return null
    if (current.type === 'ai_line') {
      return { playerId: current.speaker_id, text: current.text }
    }
    if (current.type === 'player_line') {
      return { playerId: 'human', text: current.text }
    }
    return null
  }, [current])

  const options = useMemo(() => current?.options || [], [current])

  async function hydrateFromServer(payload, sessionIdOverride = '') {
    dispatch({ type: 'hydrate', payload })
    if (sessionIdOverride) dispatch({ type: 'session', sessionId: sessionIdOverride })
  }

  async function startGame() {
    if (!name.trim()) {
      dispatch({ type: 'error', error: 'Enter your name first.' })
      return
    }
    setBusy(true)
    try {
      const data = await post('/traitors/start', { human_name: name.trim(), ai_count: 6 })
      await hydrateFromServer(data, data.session_id || '')
      setShowIntro(true)
      if (Array.isArray(data.current_item?.options)) {
        setVoteTarget(data.current_item.options[0]?.id || '')
      }
    } catch (e) {
      dispatch({ type: 'error', error: e.message })
    }
    setBusy(false)
  }

  async function callAdvance() {
    if (!engine.sessionId || busy) return
    setBusy(true)
    try {
      const data = await post('/traitors/advance', { session_id: engine.sessionId })
      await hydrateFromServer(data)
    } catch (e) {
      dispatch({ type: 'error', error: e.message })
    }
    setBusy(false)
  }

  async function callRespond(text, choice = '') {
    if (!engine.sessionId || busy) return
    setBusy(true)
    try {
      const data = await post('/traitors/respond', {
        session_id: engine.sessionId,
        text,
        choice,
        target: choice,
      })
      await hydrateFromServer(data)
      setDayInput('')
      setParlorInput('')
      setRoundtableInput('')
    } catch (e) {
      dispatch({ type: 'error', error: e.message })
    }
    setBusy(false)
  }

  async function callVote(target) {
    if (!engine.sessionId || busy) return
    setBusy(true)
    try {
      const data = await post('/traitors/vote', {
        session_id: engine.sessionId,
        target,
      })
      await hydrateFromServer(data)
    } catch (e) {
      dispatch({ type: 'error', error: e.message })
    }
    setBusy(false)
  }

  function resetGame() {
    dispatch({ type: 'reset' })
    setBusy(false)
    setShowIntro(false)
    setDayInput('')
    setParlorInput('')
    setRoundtableInput('')
    setVoteTarget('')
    setMurderTarget('')
  }

  const round = engine.meta?.round || 1

  return (
    <div className="app">
      <header className="header">
        <h1>The Traitors</h1>
        <p className="subtitle">AI Edition</p>
        <a className="back-link" href="/experiments.html">&larr; experiments</a>
      </header>

      {engine.scene === 'setup' && (
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
            {engine.error && <div className="error">{engine.error}</div>}
          </div>
        </div>
      )}

      {showIntro && engine.started && (
        <div className="intro-stage">
          <IntroSequence playerName={name} onComplete={() => setShowIntro(false)} />
        </div>
      )}

      {engine.started && !showIntro && engine.scene !== 'setup' && (
        <div className="game-area">
          <div className="phase-badge">
            Round {round} — {phase === 'day' ? 'Breakfast' : phase === 'parlor' ? 'Private Conversation' : phase === 'roundtable' ? 'Round Table' : phase === 'vote' ? 'Banishment Vote' : phase === 'night' ? 'The Turret' : phase === 'morningReveal' ? 'Morning' : 'Game Over'}
          </div>

          <CastleMap
            players={engine.players}
            phase={phase}
            lastMurdered={null}
            activeSpeech={activeSpeech}
            parlorPartnerId={engine.parlorPartnerId}
          />

          {current?.type === 'host_line' && (
            <HostDialogue
              text={current.text}
              onContinue={callAdvance}
              showContinue={engine.allowedActions.includes('advance') && !busy}
            />
          )}

          {current?.type === 'result_reveal' && (
            <div className="host-dialogue">
              <div className="host-text">
                <div className="host-name">Result</div>
                <div className="host-speech">{current.text}</div>
                {engine.allowedActions.includes('advance') && (
                  <button className="host-continue" onClick={callAdvance} disabled={busy}>continue</button>
                )}
              </div>
            </div>
          )}

          {current?.type === 'ai_line' && (
            <div className="phase-controls floating-turn">
              <div className="controls-label">{current.speaker_name}</div>
              <p className="endgame-prompt">{current.move_type ? `Move: ${String(current.move_type).replace('_', ' ')}` : 'Move: tactical statement'}</p>
              {engine.allowedActions.includes('advance') && (
                <button onClick={callAdvance} disabled={busy}>{busy ? 'waiting...' : 'Next'}</button>
              )}
            </div>
          )}

          {current?.type === 'phase_transition' && (
            <div className="phase-controls floating-turn">
              <div className="controls-label">Transition</div>
              <p className="endgame-prompt">Continue to {String(current.to_scene || '').replaceAll('_', ' ')}.</p>
              {engine.allowedActions.includes('advance') && (
                <button onClick={callAdvance} disabled={busy}>{busy ? 'waiting...' : 'Continue'}</button>
              )}
            </div>
          )}

          {current?.type === 'player_prompt' && current.prompt_kind === 'day_statement' && (
            <div className="phase-controls">
              <div className="controls-label">Your Move</div>
              <p className="endgame-prompt">{current.prompt}</p>
              <textarea value={dayInput} onChange={e => setDayInput(e.target.value)} rows={3} disabled={busy} />
              <button onClick={() => callRespond(dayInput.trim())} disabled={busy}>{busy ? 'sending...' : 'Respond'}</button>
              <button className="quiet-btn" onClick={() => callRespond('')} disabled={busy}>Say nothing</button>
            </div>
          )}

          {current?.type === 'player_prompt' && current.prompt_kind === 'parlor_statement' && (
            <div className="phase-controls parlor">
              <div className="controls-label">Private Reply</div>
              <p className="endgame-prompt">{current.prompt}</p>
              <textarea value={parlorInput} onChange={e => setParlorInput(e.target.value)} rows={3} disabled={busy} />
              <button onClick={() => callRespond(parlorInput.trim())} disabled={busy}>{busy ? 'sending...' : 'Respond'}</button>
              <button className="quiet-btn" onClick={() => callRespond('')} disabled={busy}>Say nothing</button>
            </div>
          )}

          {current?.type === 'player_prompt' && current.prompt_kind === 'roundtable_statement' && (
            <div className="phase-controls">
              <div className="controls-label">Round Table Reply</div>
              <p className="endgame-prompt">{current.prompt}</p>
              <textarea value={roundtableInput} onChange={e => setRoundtableInput(e.target.value)} rows={3} disabled={busy} />
              <button onClick={() => callRespond(roundtableInput.trim())} disabled={busy}>{busy ? 'sending...' : 'Respond'}</button>
              <button className="quiet-btn" onClick={() => callRespond('')} disabled={busy}>Say nothing</button>
            </div>
          )}

          {current?.type === 'player_prompt' && current.prompt_kind === 'murder_target' && (
            <div className="phase-controls night">
              <div className="controls-label">The Turret</div>
              <p className="endgame-prompt">{current.prompt}</p>
              <select value={murderTarget} onChange={e => setMurderTarget(e.target.value)} disabled={busy}>
                <option value="">Select target</option>
                {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
              <button className="murder-btn" onClick={() => callRespond('', murderTarget)} disabled={busy || !murderTarget}>{busy ? 'sending...' : 'Murder'}</button>
            </div>
          )}

          {current?.type === 'vote_prompt' && (
            <div className="phase-controls">
              <div className="controls-label">Banishment Vote</div>
              <p className="endgame-prompt">{current.prompt}</p>
              <select value={voteTarget} onChange={e => setVoteTarget(e.target.value)} disabled={busy}>
                <option value="">Select vote target</option>
                {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
              <button onClick={() => callVote(voteTarget)} disabled={busy || !voteTarget}>{busy ? 'voting...' : 'Submit vote'}</button>
            </div>
          )}

          <button className="reset-btn" onClick={resetGame} disabled={busy}>Reset game</button>
          {engine.error && <div className="error">{engine.error}</div>}
        </div>
      )}
    </div>
  )
}
