import { useEffect, useMemo, useReducer, useState } from 'react'
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
  const options = useMemo(() => current?.options || [], [current])
  const alivePlayers = useMemo(() => (engine.players || []).filter((p) => p.alive), [engine.players])
  const canAdvance = engine.allowedActions.includes('advance')

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

  useEffect(() => {
    if (!engine.started || !engine.scene) return
    window.dispatchEvent(
      new CustomEvent('traitors:phase_enter', { detail: { scene: engine.scene, phase } })
    )
  }, [engine.started, engine.scene, phase])

  useEffect(() => {
    if (!current) return
    window.dispatchEvent(
      new CustomEvent('traitors:line_start', {
        detail: {
          itemType: current.type,
          speaker: current.speaker_name || current.speaker_id || null,
          text: current.text || null,
        },
      })
    )
  }, [current])

  useEffect(() => {
    if (current?.type === 'vote_prompt' && options.length && !voteTarget) {
      setVoteTarget(options[0].id || '')
    }
    if (current?.type === 'player_prompt' && current.prompt_kind === 'murder_target' && options.length && !murderTarget) {
      setMurderTarget(options[0].id || '')
    }
  }, [current, options, voteTarget, murderTarget])

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
    } catch (e) {
      dispatch({ type: 'error', error: e.message })
    }
    setBusy(false)
  }

  async function callAdvance() {
    if (!engine.sessionId || busy) return
    setBusy(true)
    try {
      if (current) {
        window.dispatchEvent(
          new CustomEvent('traitors:line_end', {
            detail: { itemType: current.type, speaker: current.speaker_name || current.speaker_id || null },
          })
        )
      }
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
      setMurderTarget('')
    } catch (e) {
      dispatch({ type: 'error', error: e.message })
    }
    setBusy(false)
  }

  async function callVote(target) {
    if (!engine.sessionId || busy) return
    setBusy(true)
    try {
      window.dispatchEvent(new CustomEvent('traitors:vote_cast', { detail: { target } }))
      const data = await post('/traitors/vote', {
        session_id: engine.sessionId,
        target,
      })
      await hydrateFromServer(data)
      setVoteTarget('')
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

  function renderPromptInput(promptKind) {
    if (promptKind === 'day_statement') {
      return (
        <div className="phase-controls">
          <div className="controls-label">Breakfast and Day</div>
          <p className="endgame-prompt">{current.prompt}</p>
          <textarea value={dayInput} onChange={e => setDayInput(e.target.value)} rows={4} disabled={busy} />
          <div className="controls-actions">
            <button onClick={() => callRespond(dayInput.trim())} disabled={busy}>{busy ? 'sending...' : 'Respond'}</button>
            <button className="quiet-btn" onClick={() => callRespond('')} disabled={busy}>Say nothing</button>
          </div>
        </div>
      )
    }
    if (promptKind === 'parlor_statement') {
      return (
        <div className="phase-controls parlor">
          <div className="controls-label">Private Parlor</div>
          <p className="endgame-prompt">{current.prompt}</p>
          <textarea value={parlorInput} onChange={e => setParlorInput(e.target.value)} rows={4} disabled={busy} />
          <div className="controls-actions">
            <button onClick={() => callRespond(parlorInput.trim())} disabled={busy}>{busy ? 'sending...' : 'Respond'}</button>
            <button className="quiet-btn" onClick={() => callRespond('')} disabled={busy}>Say nothing</button>
          </div>
        </div>
      )
    }
    if (promptKind === 'roundtable_statement') {
      return (
        <div className="phase-controls roundtable">
          <div className="controls-label">Round Table</div>
          <p className="endgame-prompt">{current.prompt}</p>
          <textarea value={roundtableInput} onChange={e => setRoundtableInput(e.target.value)} rows={4} disabled={busy} />
          <div className="controls-actions">
            <button onClick={() => callRespond(roundtableInput.trim())} disabled={busy}>{busy ? 'sending...' : 'Respond'}</button>
            <button className="quiet-btn" onClick={() => callRespond('')} disabled={busy}>Say nothing</button>
          </div>
        </div>
      )
    }
    if (promptKind === 'murder_target') {
      return (
        <div className="phase-controls night">
          <div className="controls-label">Traitors' Turret</div>
          <p className="endgame-prompt">{current.prompt}</p>
          <select value={murderTarget} onChange={e => setMurderTarget(e.target.value)} disabled={busy}>
            <option value="">Select a target</option>
            {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
          <div className="controls-actions">
            <button className="murder-btn" onClick={() => callRespond('', murderTarget)} disabled={busy || !murderTarget}>{busy ? 'sending...' : 'Confirm murder'}</button>
          </div>
        </div>
      )
    }
    if (promptKind === 'endgame_choice') {
      return (
        <div className="phase-controls endgame">
          <div className="controls-label">Final Choice</div>
          <p className="endgame-prompt">{current.prompt}</p>
          <div className="controls-actions stacked">
            {options.map((opt) => (
              <button key={opt.id} onClick={() => callRespond('', opt.id)} disabled={busy}>{opt.label}</button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="phase-controls">
        <div className="controls-label">Your Move</div>
        <p className="endgame-prompt">{current.prompt || 'Choose your next move.'}</p>
        <div className="controls-actions stacked">
          {options.map((opt) => (
            <button key={opt.id} onClick={() => callRespond('', opt.id)} disabled={busy}>{opt.label}</button>
          ))}
        </div>
      </div>
    )
  }

  function renderActionCard() {
    if (!current) {
      return (
        <div className="phase-controls muted">
          <div className="controls-label">Waiting</div>
          <p className="endgame-prompt">No active queue item.</p>
        </div>
      )
    }

    if (current.type === 'host_line') {
      return (
        <HostDialogue
          text={current.text}
          onContinue={callAdvance}
          showContinue={canAdvance && !busy}
        />
      )
    }

    if (current.type === 'ai_line') {
      return (
        <div className="phase-controls">
          <div className="controls-label">{String(current.speaker_name || 'PLAYER').toUpperCase()}</div>
          <p className="endgame-prompt">{current.text}</p>
          {canAdvance && (
            <div className="controls-actions">
              <button onClick={callAdvance} disabled={busy}>{busy ? 'waiting...' : 'Next line'}</button>
            </div>
          )}
        </div>
      )
    }

    if (current.type === 'phase_transition') {
      const nextScene = String(current.to_scene || '')
      const btnLabel = nextScene.includes('PARLOR') ? 'Go to Parlor'
        : nextScene.includes('ROUNDTABLE') ? 'Go to Round Table'
        : nextScene.includes('VOTE') ? 'Go to Vote'
        : nextScene.includes('BREAKFAST') ? 'Continue'
        : nextScene.includes('MORNING') ? 'See what happened'
        : nextScene.includes('TURRET') ? 'Enter the Turret'
        : nextScene.includes('ENDED') ? 'See result'
        : 'Continue'
      return (
        <div className="phase-controls muted">
          {canAdvance && (
            <div className="controls-actions">
              <button onClick={callAdvance} disabled={busy}>{busy ? 'waiting...' : btnLabel}</button>
            </div>
          )}
        </div>
      )
    }

    if (current.type === 'player_prompt') {
      return renderPromptInput(current.prompt_kind)
    }

    if (current.type === 'vote_prompt') {
      return (
        <div className="phase-controls vote">
          <div className="controls-label">Round Table Vote</div>
          <p className="endgame-prompt">{current.prompt}</p>
          <select value={voteTarget} onChange={e => setVoteTarget(e.target.value)} disabled={busy}>
            <option value="">Select vote target</option>
            {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
          <div className="controls-actions">
            <button onClick={() => callVote(voteTarget)} disabled={busy || !voteTarget}>{busy ? 'voting...' : 'Submit vote'}</button>
          </div>
        </div>
      )
    }

    if (current.type === 'result_reveal') {
      return (
        <div className="phase-controls reveal">
          <div className="controls-label">Reveal</div>
          <p className="endgame-prompt">{current.text}</p>
          {canAdvance && (
            <div className="controls-actions">
              <button onClick={callAdvance} disabled={busy}>{busy ? 'waiting...' : 'Continue'}</button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="phase-controls muted">
        <div className="controls-label">Queue Item</div>
        <p className="endgame-prompt">{current.type}</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <a className="back-link" href="/experiments.html">&larr; experiments</a>
      </header>

      {engine.scene === 'setup' && (
        <div className="setup">
          <div className="setup-inner">
            <h1 className="title-hero">The Tr<span className="title-ai">ai</span>tors</h1>
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
                {busy ? 'Opening gates...' : 'Enter the castle'}
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
          <div className="stage-shell">
            <div className="stage-main">
              <CastleMap
                players={engine.players}
                phase={phase}
                lastMurdered={engine.meta?.last_murdered || null}
                activeSpeech={activeSpeech}
                parlorPartnerId={engine.parlorPartnerId}
              />
            </div>

            <aside className="stage-sidebar">
              <div className="action-dock">
                {renderActionCard()}
              </div>

              <div className="roster-panel">
                <div className="roster-title">CAST ROSTER</div>
                <div className="roster-list">
                  {engine.players.map((p) => (
                    <div className={`roster-item ${p.alive ? 'alive' : 'out'} ${p.isHuman ? 'you' : ''}`} key={p.id}>
                      <span className="roster-name">{String(p.name || '').toUpperCase()}</span>
                      {p.modelLabel && <span className={`roster-model tier-${(p.modelTier || '').toLowerCase()}`}>{p.modelLabel}</span>}
                      <span className="roster-state">{p.alive ? (p.isHuman ? 'YOU' : 'IN') : 'OUT'}</span>
                    </div>
                  ))}
                </div>
                <div className="roster-meta">
                  <div>Round {round}</div>
                  <div>{alivePlayers.length} players remaining</div>
                </div>
              </div>
            </aside>
          </div>

          <div className="footer-actions">
            <button className="reset-btn" onClick={resetGame} disabled={busy}>Reset game</button>
            {engine.error && <div className="error">{engine.error}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
