import PlayerToken from './PlayerToken'

// Room centres and dimensions
const ROOMS = {
  breakfast: { cx: 450, cy: 570, w: 400, h: 160 },
  roundtable: { cx: 450, cy: 330, w: 340, h: 200 },
  turret: { cx: 450, cy: 100, w: 150, h: 130 },
}

// Seat positions per room (up to 8 seats)
const BREAKFAST_SEATS = [
  { x: 340, y: 545 }, { x: 390, y: 545 }, { x: 450, y: 545 }, { x: 510, y: 545 },
  { x: 340, y: 595 }, { x: 390, y: 595 }, { x: 450, y: 595 }, { x: 510, y: 595 },
]

const ROUNDTABLE_SEATS = (() => {
  const cx = 450, cy = 330, r = 76
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 360 / 8 - 90) * Math.PI / 180
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
})()

const TURRET_SEAT = { x: 450, y: 100 }

function getSeats(phase) {
  if (phase === 'night') return null // special: only human goes to turret
  if (phase === 'roundtable' || phase === 'vote' || phase === 'endgame_choice') return ROUNDTABLE_SEATS
  return BREAKFAST_SEATS // day, morningReveal, setup, intro, ended
}

function getPlayerPosition(player, index, phase, players) {
  if (phase === 'night') {
    if (player.isHuman) return TURRET_SEAT
    // alive AIs stay at roundtable positions
    const aiIndex = players.filter(p => !p.isHuman && p.alive).indexOf(player)
    if (aiIndex >= 0 && aiIndex < ROUNDTABLE_SEATS.length) return ROUNDTABLE_SEATS[aiIndex]
    return ROUNDTABLE_SEATS[0]
  }
  const seats = getSeats(phase)
  if (!seats) return BREAKFAST_SEATS[index] || BREAKFAST_SEATS[0]
  return seats[index] || seats[0]
}

export default function CastleMap({ players, phase, lastMurdered }) {
  const activeRoom =
    phase === 'night' ? 'turret' :
    (phase === 'roundtable' || phase === 'vote' || phase === 'endgame_choice') ? 'roundtable' :
    'breakfast'

  // For morning reveal, find the murdered player's old seat
  const isMorning = phase === 'morningReveal'
  const alivePlayers = (players || []).filter(p => p.alive)

  return (
    <div className="castle-wrap">
      <svg
        viewBox="0 0 900 700"
        className="castle-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Stone pattern */}
          <pattern id="stone" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#2a2234" />
            <rect x="0" y="0" width="10" height="10" fill="#2d2538" opacity="0.5" />
            <rect x="10" y="10" width="10" height="10" fill="#272030" opacity="0.5" />
          </pattern>

          {/* Warm glow filter */}
          <filter id="glow-warm" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="1.2 0.3 0 0 0.05
                      0.2 1 0 0 0.02
                      0 0 0.6 0 0
                      0 0 0 0.6 0" />
          </filter>

          {/* Purple glow for turret */}
          <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="0.7 0 0.3 0 0.02
                      0 0.4 0.2 0 0
                      0.2 0 1.3 0 0.05
                      0 0 0 0.5 0" />
          </filter>

          {/* Candlelight radial */}
          <radialGradient id="candle-light" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcc66" stopOpacity="0.3" />
            <stop offset="60%" stopColor="#ffaa33" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffaa33" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width="900" height="700" fill="#13111a" />

        {/* === CORRIDORS === */}
        {/* Breakfast to Roundtable corridor */}
        <rect x="425" y="490" width="50" height="40"
          fill="url(#stone)" stroke="#3a3148" strokeWidth="1.5" />
        {/* Small lantern dots in corridor */}
        <circle cx="435" cy="505" r="2" fill="#dcb978" opacity="0.5" className="candle-flicker" />
        <circle cx="465" cy="515" r="2" fill="#dcb978" opacity="0.4" className="candle-flicker-alt" />

        {/* Roundtable to Turret corridor */}
        <rect x="425" y="165" width="50" height="65"
          fill="url(#stone)" stroke="#3a3148" strokeWidth="1.5" />
        <circle cx="440" cy="185" r="2" fill="#dcb978" opacity="0.4" className="candle-flicker" />
        <circle cx="460" cy="210" r="2" fill="#dcb978" opacity="0.3" className="candle-flicker-alt" />

        {/* === TURRET (top) === */}
        <g className={`room-group ${activeRoom === 'turret' ? 'active' : 'dim'}`}>
          {/* Room glow */}
          <ellipse cx="450" cy="100" rx="90" ry="75" fill="url(#candle-light)"
            filter="url(#glow-purple)" className="room-glow" />
          {/* Circular room */}
          <ellipse cx="450" cy="100" rx="75" ry="65"
            fill="#1a1428" stroke="#4a3d5c" strokeWidth="2" />
          {/* Inner details - small table */}
          <ellipse cx="450" cy="100" rx="22" ry="18"
            fill="#3a2a44" stroke="#5a4870" strokeWidth="1" opacity="0.7" />
          {/* Candles */}
          <circle cx="430" cy="80" r="3" fill="#dcb978" opacity="0.7" className="candle-flicker" />
          <circle cx="470" cy="80" r="3" fill="#dcb978" opacity="0.6" className="candle-flicker-alt" />
          {/* Room label */}
          <text x="450" y="155" textAnchor="middle" className="room-label">
            Turret
          </text>
        </g>

        {/* === ROUND TABLE ROOM (center) === */}
        <g className={`room-group ${activeRoom === 'roundtable' ? 'active' : 'dim'}`}>
          {/* Room glow */}
          <rect x="265" y="218" width="370" height="224" rx="4"
            fill="url(#candle-light)" filter="url(#glow-warm)" className="room-glow" />
          {/* Room walls */}
          <rect x="280" y="230" width="340" height="200" rx="3"
            fill="url(#stone)" stroke="#4a3d5c" strokeWidth="2" />
          {/* Floor */}
          <rect x="285" y="235" width="330" height="190" rx="2"
            fill="#211a2e" />
          {/* The round table */}
          <circle cx="450" cy="330" r="45"
            fill="radial-gradient(circle, #6b4e34, #4a3422)" className="round-table" />
          <circle cx="450" cy="330" r="45"
            fill="#5a3f2a" stroke="#8f7250" strokeWidth="2" />
          <circle cx="450" cy="330" r="40"
            fill="none" stroke="#7a6040" strokeWidth="0.5" opacity="0.4" />
          {/* Central candelabra glow */}
          <circle cx="450" cy="330" r="8" fill="#dcb978" opacity="0.8" className="candle-flicker" />
          <circle cx="450" cy="330" r="25" fill="#ffcc66" opacity="0.08" />
          {/* Wall candles */}
          <circle cx="295" cy="260" r="3" fill="#dcb978" opacity="0.5" className="candle-flicker-alt" />
          <circle cx="605" cy="260" r="3" fill="#dcb978" opacity="0.5" className="candle-flicker" />
          <circle cx="295" cy="400" r="3" fill="#dcb978" opacity="0.4" className="candle-flicker" />
          <circle cx="605" cy="400" r="3" fill="#dcb978" opacity="0.4" className="candle-flicker-alt" />
          {/* Room label */}
          <text x="450" y="448" textAnchor="middle" className="room-label">
            Round Table
          </text>
        </g>

        {/* === BREAKFAST HALL (bottom) === */}
        <g className={`room-group ${activeRoom === 'breakfast' ? 'active' : 'dim'}`}>
          {/* Room glow */}
          <rect x="235" y="478" width="430" height="192" rx="4"
            fill="url(#candle-light)" filter="url(#glow-warm)" className="room-glow" />
          {/* Room walls */}
          <rect x="250" y="490" width="400" height="160" rx="3"
            fill="url(#stone)" stroke="#4a4538" strokeWidth="2" />
          {/* Floor - warmer tone */}
          <rect x="255" y="495" width="390" height="150" rx="2"
            fill="#1f2420" />
          {/* Long breakfast table */}
          <rect x="360" y="555" width="180" height="30" rx="3"
            fill="#5a4832" stroke="#7a6342" strokeWidth="1.5" />
          {/* Table details */}
          <rect x="365" y="560" width="170" height="20" rx="2"
            fill="none" stroke="#6a5538" strokeWidth="0.5" opacity="0.4" />
          {/* Candles on table */}
          <circle cx="405" cy="570" r="2.5" fill="#dcb978" opacity="0.6" className="candle-flicker" />
          <circle cx="495" cy="570" r="2.5" fill="#dcb978" opacity="0.5" className="candle-flicker-alt" />
          {/* Wall sconces */}
          <circle cx="270" cy="510" r="3" fill="#dcb978" opacity="0.4" className="candle-flicker-alt" />
          <circle cx="630" cy="510" r="3" fill="#dcb978" opacity="0.4" className="candle-flicker" />
          {/* Chair outlines for morning reveal */}
          {BREAKFAST_SEATS.map((seat, i) => (
            <rect key={`chair-${i}`}
              x={seat.x - 8} y={seat.y - 8} width="16" height="16" rx="2"
              fill="none" stroke="#3a3530" strokeWidth="0.8" opacity="0.4" />
          ))}
          {/* Room label */}
          <text x="450" y="664" textAnchor="middle" className="room-label">
            Breakfast Hall
          </text>
        </g>

        {/* === OUTER WALLS / CASTLE OUTLINE === */}
        {/* Top towers */}
        <rect x="200" y="20" width="20" height="30" fill="#2a2234" stroke="#3a3148" strokeWidth="1" />
        <rect x="680" y="20" width="20" height="30" fill="#2a2234" stroke="#3a3148" strokeWidth="1" />
        {/* Battlements hint */}
        {[220, 250, 280, 600, 630, 660].map(x => (
          <rect key={`battlement-${x}`} x={x} y="25" width="8" height="12"
            fill="#2a2234" stroke="#3a3148" strokeWidth="0.5" opacity="0.3" />
        ))}

        {/* === FOG LAYER === */}
        <rect x="0" y="400" width="900" height="300"
          fill="url(#candle-light)" opacity="0.04" className="fog-drift" />

        {/* === PLAYER TOKENS === */}
        {(players || []).map((player, index) => {
          if (!player.alive && phase !== 'morningReveal') return null
          const pos = getPlayerPosition(player, index, phase, players)
          const isEmpty = isMorning && lastMurdered && player.id === lastMurdered.id
          if (isEmpty) return null // don't show murdered player during reveal

          return (
            <PlayerToken
              key={player.id}
              player={player}
              x={pos.x}
              y={pos.y}
              isHuman={player.isHuman}
            />
          )
        })}

        {/* Morning reveal: empty chair highlight */}
        {isMorning && lastMurdered && (() => {
          const deadIndex = (players || []).findIndex(p => p.id === lastMurdered.id)
          if (deadIndex < 0) return null
          const seat = BREAKFAST_SEATS[deadIndex]
          if (!seat) return null
          return (
            <g className="empty-chair-pulse">
              <rect x={seat.x - 10} y={seat.y - 10} width="20" height="20" rx="3"
                fill="none" stroke="#dcb978" strokeWidth="1.5" opacity="0.7" />
              <text x={seat.x} y={seat.y + 3} textAnchor="middle"
                fill="#dcb978" fontSize="8" opacity="0.8">?</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
