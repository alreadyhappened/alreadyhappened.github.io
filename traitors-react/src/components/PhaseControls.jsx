export default function PhaseControls({
  phase,
  busy,
  alivePlayers,
  // Day
  dayLine, setDayLine, onRunDay, onRunDaySilent,
  // Roundtable
  roundtableLine, setRoundtableLine, onRunRoundtable, onRunRoundtableSilent,
  // Vote
  voteTarget, setVoteTarget, onRunVote,
  // Night
  nightTarget, setNightTarget, onRunNight,
  // Endgame
  onEndgameChoice,
  // Ended
  winner,
}) {
  const aliveAIs = alivePlayers.filter(p => !p.isHuman)

  if (phase === 'day') {
    return (
      <div className="phase-controls">
        <div className="controls-label">Breakfast &amp; Day</div>
        <textarea
          value={dayLine}
          onChange={e => setDayLine(e.target.value)}
          placeholder="At breakfast and through the day, sell your Faithful story..."
          disabled={busy}
          rows={3}
        />
        <button onClick={onRunDay} disabled={busy}>
          {busy ? 'waiting...' : 'Continue'}
        </button>
        <button className="quiet-btn" onClick={onRunDaySilent} disabled={busy}>
          Say nothing
        </button>
      </div>
    )
  }

  if (phase === 'roundtable') {
    return (
      <div className="phase-controls">
        <div className="controls-label">Round Table</div>
        <textarea
          value={roundtableLine}
          onChange={e => setRoundtableLine(e.target.value)}
          placeholder="Push suspicion onto another player, or defend yourself..."
          disabled={busy}
          rows={3}
        />
        <button onClick={onRunRoundtable} disabled={busy}>
          {busy ? 'waiting...' : 'Continue'}
        </button>
        <button className="quiet-btn" onClick={onRunRoundtableSilent} disabled={busy}>
          Say nothing
        </button>
      </div>
    )
  }

  if (phase === 'vote') {
    return (
      <div className="phase-controls">
        <div className="controls-label">Banishment Vote</div>
        <select value={voteTarget} onChange={e => setVoteTarget(e.target.value)} disabled={busy}>
          {aliveAIs.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={onRunVote} disabled={busy || !voteTarget}>
          {busy ? 'voting...' : 'Cast vote'}
        </button>
      </div>
    )
  }

  if (phase === 'night') {
    return (
      <div className="phase-controls night">
        <div className="controls-label">The Turret</div>
        <select value={nightTarget} onChange={e => setNightTarget(e.target.value)} disabled={busy}>
          {aliveAIs.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="murder-btn" onClick={onRunNight} disabled={busy || !nightTarget}>
          {busy ? 'waiting...' : 'Murder'}
        </button>
      </div>
    )
  }

  if (phase === 'endgame_choice') {
    return (
      <div className="phase-controls endgame">
        <div className="controls-label">The Final Choice</div>
        <p className="endgame-prompt">Do you believe all Traitors have been found?</p>
        <div className="endgame-buttons">
          <button className="endgame-end" onClick={() => onEndgameChoice('end')} disabled={busy}>
            End Game
          </button>
          <button className="endgame-banish" onClick={() => onEndgameChoice('banish')} disabled={busy}>
            Banish Again
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'ended') {
    return (
      <div className="phase-controls ended">
        <div className="controls-label">Game Over</div>
        <p className="ended-text">
          {winner === 'human'
            ? 'You reached the final two. Traitor wins.'
            : 'The Faithful banished you. AI wins.'}
        </p>
      </div>
    )
  }

  return null
}
