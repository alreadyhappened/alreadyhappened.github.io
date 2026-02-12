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
const PARLOR_HUMAN = { x: 360, y: 320 }
const PARLOR_AI = { x: 550, y: 320 }

function sceneRoom(phase) {
  if (phase === 'night') return 'turret'
  if (phase === 'parlor') return 'parlor'
  if (phase === 'roundtable' || phase === 'vote' || phase === 'endgame_choice') return 'roundtable'
  return 'breakfast'
}

function playerPosition(player, index, phase, players, parlorPartnerId) {
  const room = sceneRoom(phase)
  if (room === 'turret') {
    return TURRET_CENTER
  }
  if (room === 'parlor') {
    if (player.isHuman) return PARLOR_HUMAN
    if (player.id === parlorPartnerId) return PARLOR_AI
    return PARLOR_AI
  }
  const seats = room === 'roundtable' ? ROUNDTABLE_SEATS : BREAKFAST_SEATS
  return seats[index] || seats[0]
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export default function CastleMap({ players, phase, lastMurdered, activeSpeech, parlorPartnerId }) {
  const room = sceneRoom(phase)
  const isMorning = phase === 'morningReveal'
  const isPrelude = phase === 'day'

  let visiblePlayers = (players || []).filter((p) => p.alive || isMorning)
  if (room === 'turret') {
    visiblePlayers = visiblePlayers.filter((p) => p.isHuman)
  } else if (room === 'parlor') {
    visiblePlayers = visiblePlayers.filter((p) => p.isHuman || p.id === parlorPartnerId)
  }
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
    const pos = playerPosition(visiblePlayers[targetIndex], targetIndex, phase, visiblePlayers, parlorPartnerId)
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

        <rect width="900" height="540" fill="#120e18" />
        <circle cx="120" cy="80" r="220" fill="#5f3b5f" opacity="0.15" />
        <circle cx="790" cy="100" r="180" fill="#3f6f6a" opacity="0.12" />

        {room === 'breakfast' && (
          <g>
            <rect x="220" y="172" width="470" height="304" rx="18" fill="url(#stone)" stroke="#8f6e58" strokeWidth="2" />
            <rect x="232" y="184" width="446" height="280" rx="12" fill="#21302a" />
            <rect x="338" y="314" width="234" height="34" rx="10" fill="#7b4d3f" stroke="#d9ab7e" strokeWidth="1.4" />
            <circle cx="393" cy="332" r="3" fill="#dcb978" className="candle-flicker" />
            <circle cx="515" cy="332" r="3" fill="#dcb978" className="candle-flicker-alt" />
            <ellipse cx="455" cy="325" rx="220" ry="110" fill="url(#candle-light)" opacity="0.35" />
            <text x="455" y="500" textAnchor="middle" className="room-label">Breakfast Hall</text>
          </g>
        )}

        {room === 'parlor' && (
          <g>
            <rect x="245" y="166" width="420" height="300" rx="18" fill="url(#stone)" stroke="#936e8b" strokeWidth="2" />
            <rect x="257" y="178" width="396" height="276" rx="12" fill="#2c1f32" />
            <rect x="338" y="250" width="234" height="28" rx="8" fill="#5a3c63" stroke="#8f74a6" strokeWidth="1.2" />
            <rect x="356" y="292" width="90" height="50" rx="8" fill="#3f4e66" stroke="#8fa8c8" strokeWidth="1.2" />
            <rect x="464" y="292" width="90" height="50" rx="8" fill="#66433f" stroke="#c59892" strokeWidth="1.2" />
            <ellipse cx="455" cy="312" rx="170" ry="118" fill="url(#candle-light)" opacity="0.28" />
            <text x="455" y="500" textAnchor="middle" className="room-label">Parlor</text>
          </g>
        )}

        {room === 'roundtable' && (
          <g>
            <rect x="250" y="140" width="410" height="340" rx="16" fill="url(#stone)" stroke="#8a6592" strokeWidth="2" />
            <rect x="260" y="150" width="390" height="320" rx="12" fill="#211a2e" />
            <circle cx="455" cy="332" r="74" fill="#60422f" stroke="#b08b64" strokeWidth="2.2" />
            <circle cx="455" cy="332" r="56" fill="none" stroke="#7a6040" strokeWidth="0.6" opacity="0.45" />
            <circle cx="455" cy="332" r="8" fill="#dcb978" className="candle-flicker" />
            <ellipse cx="455" cy="332" rx="170" ry="130" fill="url(#candle-light)" opacity="0.3" />
            <text x="455" y="500" textAnchor="middle" className="room-label">Round Table</text>
          </g>
        )}

        {room === 'turret' && (
          <g>
            <ellipse cx="455" cy="250" rx="170" ry="200" fill="url(#stone)" stroke="#805a86" strokeWidth="2" />
            <ellipse cx="455" cy="250" rx="158" ry="186" fill="#1a1428" />
            <ellipse cx="455" cy="248" rx="42" ry="32" fill="#3a2a44" stroke="#8b6ba0" strokeWidth="1.2" opacity="0.85" />
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
          const pos = playerPosition(player, index, phase, visiblePlayers, parlorPartnerId)
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
