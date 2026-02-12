const AI_COLORS = [
  '#7b6a92', '#6a8a7a', '#8a7060', '#6a7a9a',
  '#9a6a7a', '#7a8a60', '#8a6a90', '#6a9a8a',
]

export default function PlayerToken({ player, x, y, isHuman }) {
  const initial = (player.name || '?')[0].toUpperCase()
  const colorIndex = parseInt((player.id || '').replace(/\D/g, '') || '0', 10) % AI_COLORS.length
  const fill = isHuman ? '#8a3a2a' : AI_COLORS[colorIndex]
  const stroke = isHuman ? '#d57b5f' : '#5f506f'
  const dead = !player.alive

  return (
    <g
      className={`player-token ${dead ? 'dead' : ''} ${isHuman ? 'human' : ''}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <circle r="12" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#f0e8f8"
        fontSize="9"
        fontWeight={isHuman ? 'bold' : 'normal'}
        fontFamily="Georgia, serif"
      >
        {initial}
      </text>
      {/* Name label below */}
      <text
        y="20"
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
