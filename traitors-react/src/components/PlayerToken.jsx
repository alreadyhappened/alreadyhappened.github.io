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
      <ellipse cx="0" cy="7" rx="16" ry="7" fill="#0f0d16" opacity="0.28" />
      <circle cx="0" cy="-2" r="16" fill={fill} stroke={stroke} strokeWidth="1.8" />
      <path d="M -13 -5 Q -1 -18 13 -5 L 13 -15 L -13 -15 Z" fill={hair} opacity="0.92" />
      <circle cx="-4.7" cy="-2.2" r="1.25" fill="#201912" />
      <circle cx="4.7" cy="-2.2" r="1.25" fill="#201912" />
      <path d="M -3.1 4 Q 0 6.4 3.1 4" stroke="#6f4c33" strokeWidth="1.1" fill="none" />
      <rect x="-8.2" y="12" width="16.4" height="8.4" rx="4" fill={fill} stroke={stroke} strokeWidth="0.8" />
      <rect x="-6.2" y="13.5" width="12.4" height="5.1" rx="2.8" fill={skin} opacity="0.22" />
      {/* Name label below */}
      <text
        y="33"
        textAnchor="middle"
        fill="#c8bdd8"
        fontSize="9"
        fontFamily='"Trebuchet MS", Georgia, serif'
        opacity="0.93"
      >
        {player.name}
        {isHuman ? ' (you)' : ''}
      </text>
      {dead && (
        <>
          <line x1="-11" y1="-11" x2="11" y2="11" stroke="#ff6666" strokeWidth="2.4" opacity="0.85" />
          <line x1="11" y1="-11" x2="-11" y2="11" stroke="#ff6666" strokeWidth="2.4" opacity="0.85" />
        </>
      )}
    </g>
  )
}
