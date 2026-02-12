export default function EndgameVote({ aiChoices, outcome, busy }) {
  if (!aiChoices || !aiChoices.length) return null

  return (
    <div className="endgame-reveal">
      <div className="endgame-results">
        {aiChoices.map((choice, i) => (
          <div
            key={choice.id || i}
            className={`endgame-pouch ${choice.choice === 'end' ? 'green' : 'red'}`}
          >
            <div className="pouch-name">{choice.name}</div>
            <div className="pouch-choice">
              {choice.choice === 'end' ? 'End Game' : 'Banish Again'}
            </div>
            {choice.reason && (
              <div className="pouch-reason">{choice.reason}</div>
            )}
          </div>
        ))}
      </div>
      <div className="endgame-outcome">
        {outcome === 'end'
          ? 'Unanimous. The game ends.'
          : 'Not unanimous. Another banishment round begins.'}
      </div>
    </div>
  )
}
