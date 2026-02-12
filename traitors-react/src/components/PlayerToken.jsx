const AI_COLORS = [
  '#7b6a92', '#6a8a7a', '#8a7060', '#6a7a9a',
  '#9a6a7a', '#7a8a60', '#8a6a90', '#6a9a8a',
]

export default function PlayerToken({ player, x, y, isHuman }) {
  const colorIndex = parseInt((player.id || '').replace(/\D/g, '') || '0', 10) % AI_COLORS.length
  const fill = isHuman ? '#8a3a2a' : AI_COLORS[colorIndex]
  const stroke = isHuman ? '#d57b5f' : '#5f506f'
  const dead = !player.alive
  const skin = ['#f2d3b6', '#e8bf9a', '#dcae83', '#c9976c'][colorIndex % 4]
  const hair = ['#2a1f1a', '#3b2a20', '#2f2f3e', '#2f3b2c', '#4a2d1f'][colorIndex % 5]

  return (
    <g
      className={`player-token ${dead ? 'dead' : ''} ${isHuman ? 'human' : ''}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <ellipse cx="0" cy="2" rx="10.5" ry="12" fill="#0f0d16" opacity="0.25" />
      <circle cx="0" cy="0" r="12" fill={fill} stroke={stroke} strokeWidth="1.4" />
      <path d="M -10 -2 Q -1 -13 10 -2 L 10 -10 L -10 -10 Z" fill={hair} opacity="0.9" />
      <circle cx="-3.6" cy="-0.5" r="1.05" fill="#201912" />
      <circle cx="3.6" cy="-0.5" r="1.05" fill="#201912" />
      <path d="M -2.4 4 Q 0 5.7 2.4 4" stroke="#6f4c33" strokeWidth="0.8" fill="none" />
      <rect x="-4.6" y="11" width="9.2" height="4.2" rx="2" fill={fill} stroke={stroke} strokeWidth="0.6" />
      {/* Name label below */}
      <text
        y="24"
        textAnchor="middle"
        fill="#c8bdd8"
        fontSize="7"
        fontFamily="Georgia, serif"
        opacity="0.85"
      >
        {player.name}
        {isHuman ? ' (you)' : ''}
      </text>
      {dead && (
        <>
          <line x1="-8" y1="-8" x2="8" y2="8" stroke="#ff6666" strokeWidth="2" opacity="0.8" />
          <line x1="8" y1="-8" x2="-8" y2="8" stroke="#ff6666" strokeWidth="2" opacity="0.8" />
        </>
      )}
    </g>
  )
}
