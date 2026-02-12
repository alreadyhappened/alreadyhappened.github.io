export default function BreakfastPrelude({ lines, onContinue, busy }) {
  if (!lines?.length) return null

  return (
    <div className="phase-controls prelude">
      <div className="controls-label">Breakfast chatter</div>
      <div className="prelude-lines">
        {lines.map((line, idx) => (
          <div className="prelude-line" key={`${line.speaker}-${idx}`}>
            <span className="prelude-speaker">{line.speaker}</span>
            <span className="prelude-text">{line.text}</span>
          </div>
        ))}
      </div>
      <button onClick={onContinue} disabled={busy}>
        Join the conversation
      </button>
    </div>
  )
}

