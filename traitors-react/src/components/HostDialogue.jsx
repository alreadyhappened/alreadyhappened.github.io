export default function HostDialogue({ text, onContinue, showContinue, large = false }) {
  if (!text) return null

  return (
    <div className={`host-dialogue ${large ? 'large' : ''}`}>
      <div className="host-icon">
        <svg viewBox="0 0 40 50" width={large ? 62 : 36} height={large ? 78 : 45}>
          {/* Hair */}
          <ellipse cx="20" cy="24" rx="18" ry="22" fill="#1a1118" />
          {/* Face */}
          <ellipse cx="20" cy="26" rx="11" ry="12" fill="#d4a88a" />
          {/* Fringe */}
          <path d="M 6 22 Q 10 12, 20 10 Q 30 12, 34 22 L 34 18 Q 28 6, 20 4 Q 12 6, 6 18 Z" fill="#1a1118" />
          <path d="M 8 22 Q 14 16, 20 15 Q 26 16, 32 22" fill="none" stroke="#151015" strokeWidth="4" strokeLinecap="round" />
          {/* Smokey eyes */}
          <ellipse cx="15" cy="24" rx="3.5" ry="2" fill="#2a1828" opacity="0.5" />
          <ellipse cx="25" cy="24" rx="3.5" ry="2" fill="#2a1828" opacity="0.5" />
          {/* Eyes */}
          <ellipse cx="15" cy="24" rx="2" ry="1.5" fill="#fff" />
          <ellipse cx="25" cy="24" rx="2" ry="1.5" fill="#fff" />
          <circle cx="15.3" cy="24" r="1" fill="#4a3020" />
          <circle cx="25.3" cy="24" r="1" fill="#4a3020" />
          {/* Mouth */}
          <path d="M 17 31 Q 20 33, 23 31" fill="none" stroke="#b86860" strokeWidth="0.7" strokeLinecap="round" />
          {/* Side hair */}
          <path d="M 8 22 Q 5 28, 6 38" fill="#1a1118" />
          <path d="M 32 22 Q 35 28, 34 38" fill="#1a1118" />
        </svg>
      </div>
      <div className="host-text">
        <div className="host-name">Clawdia Winkelman</div>
        <div className="host-speech">{text}</div>
        {showContinue && (
          <button className="host-continue" onClick={onContinue}>
            continue
          </button>
        )}
      </div>
    </div>
  )
}
