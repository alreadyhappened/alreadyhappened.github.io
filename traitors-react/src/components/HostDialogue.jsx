export default function HostDialogue({ text, onContinue, showContinue, large = false }) {
  if (!text) return null

  return (
    <div className={`host-dialogue ${large ? 'large' : ''}`}>
      <div className="host-icon">
        {/* Clawdia cat face */}
        <svg viewBox="0 0 40 40" width={large ? 62 : 36} height={large ? 62 : 36}>
          {/* Ears */}
          <polygon points="8,16 14,4 18,16" fill="#dcb978" opacity="0.9" />
          <polygon points="32,16 26,4 22,16" fill="#dcb978" opacity="0.9" />
          {/* Face */}
          <ellipse cx="20" cy="22" rx="13" ry="12" fill="#2a2234" stroke="#dcb978" strokeWidth="1" />
          {/* Glasses */}
          <circle cx="15" cy="20" r="4.5" fill="none" stroke="#dcb978" strokeWidth="0.8" />
          <circle cx="25" cy="20" r="4.5" fill="none" stroke="#dcb978" strokeWidth="0.8" />
          <line x1="19.5" y1="20" x2="20.5" y2="20" stroke="#dcb978" strokeWidth="0.6" />
          {/* Eyes */}
          <circle cx="15" cy="20" r="1.5" fill="#dcb978" />
          <circle cx="25" cy="20" r="1.5" fill="#dcb978" />
          {/* Nose */}
          <polygon points="20,24 18.5,26 21.5,26" fill="#dcb978" opacity="0.7" />
          {/* Whiskers */}
          <line x1="6" y1="24" x2="15" y2="25" stroke="#dcb978" strokeWidth="0.5" opacity="0.5" />
          <line x1="6" y1="27" x2="15" y2="27" stroke="#dcb978" strokeWidth="0.5" opacity="0.5" />
          <line x1="34" y1="24" x2="25" y2="25" stroke="#dcb978" strokeWidth="0.5" opacity="0.5" />
          <line x1="34" y1="27" x2="25" y2="27" stroke="#dcb978" strokeWidth="0.5" opacity="0.5" />
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
