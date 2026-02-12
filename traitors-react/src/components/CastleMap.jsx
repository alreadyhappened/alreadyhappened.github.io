import PlayerToken from './PlayerToken'

const BREAKFAST_SEATS = [
  { x: 335, y: 332 }, { x: 390, y: 300 }, { x: 455, y: 286 }, { x: 520, y: 300 },
  { x: 575, y: 332 }, { x: 520, y: 364 }, { x: 455, y: 378 }, { x: 390, y: 364 },
]

const ROUNDTABLE_SEATS = [
  { x: 335, y: 332 }, { x: 390, y: 286 }, { x: 455, y: 272 }, { x: 520, y: 286 },
  { x: 575, y: 332 }, { x: 520, y: 378 }, { x: 455, y: 392 }, { x: 390, y: 378 },
]

const TURRET_CENTER = { x: 455, y: 248 }

function sceneRoom(phase) {
  if (phase === 'night') return 'turret'
  if (phase === 'roundtable' || phase === 'vote' || phase === 'endgame_choice') return 'roundtable'
  return 'breakfast'
}

function playerPosition(player, index, phase, players) {
  const room = sceneRoom(phase)
  if (room === 'turret') {
    if (player.isHuman) return TURRET_CENTER
    const ai = players.filter((p) => !p.isHuman && p.alive)
    const aiIndex = ai.findIndex((p) => p.id === player.id)
    return ROUNDTABLE_SEATS[Math.max(0, aiIndex)] || ROUNDTABLE_SEATS[0]
  }
  const seats = room === 'roundtable' ? ROUNDTABLE_SEATS : BREAKFAST_SEATS
  return seats[index] || seats[0]
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export default function CastleMap({ players, phase, lastMurdered, activeSpeech }) {
  const room = sceneRoom(phase)
  const isMorning = phase === 'morningReveal'
  const isPrelude = phase === 'dayPrelude'

  const visiblePlayers = (players || []).filter((p) => p.alive || isMorning)
  const aliveAi = (players || []).filter((p) => p.alive && !p.isHuman)

  const aiGazePairs = isPrelude
    ? [
        [aliveAi[0], aliveAi[2]],
        [aliveAi[1], aliveAi[4]],
        [aliveAi[3], aliveAi[5]],
      ].filter((pair) => pair[0] && pair[1])
    : []

  const bubble = (() => {
    if (!activeSpeech?.playerId || !activeSpeech?.text) return null
    const targetIndex = visiblePlayers.findIndex((p) => p.id === activeSpeech.playerId)
    if (targetIndex < 0) return null
    const pos = playerPosition(visiblePlayers[targetIndex], targetIndex, phase, visiblePlayers)
    const text = String(activeSpeech.text).replace(/\s+/g, ' ').trim()
    if (!text) return null
    const safeText = text.length > 92 ? `${text.slice(0, 89)}...` : text
    const boxW = clamp(130 + safeText.length * 2.1, 150, 290)
    const left = clamp(pos.x - boxW / 2, 20, 880 - boxW)
    const top = clamp(pos.y - 66, 30, 470)
    return { left, top, width: boxW, text: safeText }
  })()

  return (
    <div className="castle-wrap">
      <svg viewBox="0 0 900 540" className="castle-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="stone" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#2a2234" />
            <rect x="0" y="0" width="10" height="10" fill="#2d2538" opacity="0.5" />
            <rect x="10" y="10" width="10" height="10" fill="#272030" opacity="0.5" />
          </pattern>
          <radialGradient id="candle-light" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcc66" stopOpacity="0.3" />
            <stop offset="60%" stopColor="#ffaa33" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffaa33" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="900" height="540" fill="#13111a" />

        {room === 'breakfast' && (
          <g>
            <rect x="220" y="180" width="470" height="290" rx="6" fill="url(#stone)" stroke="#4a4538" strokeWidth="2" />
            <rect x="228" y="188" width="454" height="274" rx="3" fill="#1f2420" />
            <rect x="350" y="318" width="210" height="28" rx="3" fill="#5a4832" stroke="#7a6342" strokeWidth="1.4" />
            <circle cx="393" cy="332" r="3" fill="#dcb978" className="candle-flicker" />
            <circle cx="515" cy="332" r="3" fill="#dcb978" className="candle-flicker-alt" />
            <ellipse cx="455" cy="325" rx="220" ry="110" fill="url(#candle-light)" opacity="0.35" />
            <text x="455" y="500" textAnchor="middle" className="room-label">Breakfast Hall</text>
          </g>
        )}

        {room === 'roundtable' && (
          <g>
            <rect x="250" y="140" width="410" height="340" rx="6" fill="url(#stone)" stroke="#4a3d5c" strokeWidth="2" />
            <rect x="258" y="148" width="394" height="324" rx="3" fill="#211a2e" />
            <circle cx="455" cy="332" r="64" fill="#5a3f2a" stroke="#8f7250" strokeWidth="2" />
            <circle cx="455" cy="332" r="56" fill="none" stroke="#7a6040" strokeWidth="0.6" opacity="0.45" />
            <circle cx="455" cy="332" r="8" fill="#dcb978" className="candle-flicker" />
            <ellipse cx="455" cy="332" rx="170" ry="130" fill="url(#candle-light)" opacity="0.3" />
            <text x="455" y="500" textAnchor="middle" className="room-label">Round Table</text>
          </g>
        )}

        {room === 'turret' && (
          <g>
            <ellipse cx="455" cy="250" rx="160" ry="190" fill="url(#stone)" stroke="#4a3d5c" strokeWidth="2" />
            <ellipse cx="455" cy="250" rx="152" ry="182" fill="#1a1428" />
            <ellipse cx="455" cy="248" rx="36" ry="28" fill="#3a2a44" stroke="#5a4870" strokeWidth="1" opacity="0.8" />
            <circle cx="428" cy="214" r="3" fill="#dcb978" className="candle-flicker" />
            <circle cx="482" cy="214" r="3" fill="#dcb978" className="candle-flicker-alt" />
            <ellipse cx="455" cy="248" rx="120" ry="110" fill="url(#candle-light)" opacity="0.35" />
            <text x="455" y="470" textAnchor="middle" className="room-label">Traitors' Turret</text>
          </g>
        )}

        {aiGazePairs.map(([from, to], idx) => {
          const fromIndex = visiblePlayers.findIndex((p) => p.id === from.id)
          const toIndex = visiblePlayers.findIndex((p) => p.id === to.id)
          const a = playerPosition(from, fromIndex, phase, visiblePlayers)
          const b = playerPosition(to, toIndex, phase, visiblePlayers)
          return (
            <line
              key={`gaze-${idx}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#dcb978"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.45"
            />
          )
        })}

        {visiblePlayers.map((player, index) => {
          if (isMorning && lastMurdered && player.id === lastMurdered.id) return null
          const pos = playerPosition(player, index, phase, visiblePlayers)
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

        {isMorning && lastMurdered && (() => {
          const deadIndex = (players || []).findIndex((p) => p.id === lastMurdered.id)
          if (deadIndex < 0) return null
          const seat = BREAKFAST_SEATS[deadIndex] || BREAKFAST_SEATS[0]
          return (
            <g className="empty-chair-pulse">
              <rect x={seat.x - 11} y={seat.y - 11} width="22" height="22" rx="3" fill="none" stroke="#dcb978" strokeWidth="1.5" opacity="0.7" />
              <text x={seat.x} y={seat.y + 3} textAnchor="middle" fill="#dcb978" fontSize="8" opacity="0.8">?</text>
            </g>
          )
        })()}

        {bubble && (
          <g className="speech-bubble">
            <rect x={bubble.left} y={bubble.top} width={bubble.width} height="38" rx="8" fill="#f7efd8" stroke="#6b5235" strokeWidth="1.2" />
            <polygon points={`${bubble.left + 14},${bubble.top + 38} ${bubble.left + 24},${bubble.top + 38} ${bubble.left + 18},${bubble.top + 46}`} fill="#f7efd8" stroke="#6b5235" strokeWidth="1.1" />
            <text x={bubble.left + 10} y={bubble.top + 23} fill="#2a1d12" fontSize="11" fontFamily="Georgia, serif">
              {bubble.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
