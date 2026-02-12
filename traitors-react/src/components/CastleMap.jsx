import PlayerToken from './PlayerToken'

const BASE = import.meta.env.BASE_URL

const ROOM_IMAGES = {
  breakfast: `${BASE}rooms/breakfast.png`,
  roundtable: `${BASE}rooms/roundtable.png`,
  parlor: `${BASE}rooms/parlor.png`,
  turret: `${BASE}rooms/turret.png`,
}

const BREAKFAST_SEATS = [
  { x: 280, y: 560 },
  { x: 470, y: 410 },
  { x: 720, y: 350 },
  { x: 970, y: 350 },
  { x: 1180, y: 410 },
  { x: 1340, y: 560 },
  { x: 800, y: 680 },
]

const ROUNDTABLE_SEATS = [
  { x: 310, y: 590 },
  { x: 440, y: 410 },
  { x: 700, y: 330 },
  { x: 960, y: 360 },
  { x: 1200, y: 530 },
  { x: 1060, y: 720 },
  { x: 600, y: 730 },
]

const PARLOR_HUMAN = { x: 520, y: 570 }
const PARLOR_AI = { x: 1080, y: 570 }
const TURRET_HUMAN = { x: 1000, y: 550 }

function sceneRoom(phase) {
  if (phase === 'night') return 'turret'
  if (phase === 'parlor') return 'parlor'
  if (phase === 'roundtable' || phase === 'vote' || phase === 'ended') return 'roundtable'
  return 'breakfast'
}

function pickSeats(seats, count) {
  if (count >= seats.length) return seats
  const step = seats.length / Math.max(1, count)
  return Array.from({ length: count }, (_, idx) => seats[Math.floor(idx * step) % seats.length])
}

function playerPosition(player, index, room, players, parlorPartnerId) {
  if (room === 'turret') return TURRET_HUMAN
  if (room === 'parlor') {
    if (player.isHuman) return PARLOR_HUMAN
    if (player.id === parlorPartnerId) return PARLOR_AI
    return PARLOR_AI
  }
  const baseSeats = room === 'roundtable' ? ROUNDTABLE_SEATS : BREAKFAST_SEATS
  const seats = pickSeats(baseSeats, players.length)
  return seats[index] || seats[0]
}

function roomTitle(room, phase) {
  if (room === 'turret') return "TRAITORS' TURRET"
  if (room === 'parlor') return 'PRIVATE PARLOR'
  if (room === 'roundtable') return phase === 'vote' ? 'BANISHMENT VOTE' : 'ROUND TABLE'
  return phase === 'morningReveal' ? 'MORNING REVEAL' : 'BREAKFAST HALL'
}

export default function CastleMap({ players, phase, lastMurdered, activeSpeech, parlorPartnerId }) {
  const room = sceneRoom(phase)
  const isMorning = phase === 'morningReveal'
  const roomImage = ROOM_IMAGES[room]

  let visiblePlayers = (players || []).filter((p) => p.alive || isMorning)
  if (room === 'turret') {
    visiblePlayers = visiblePlayers.filter((p) => p.isHuman)
  } else if (room === 'parlor') {
    visiblePlayers = visiblePlayers.filter((p) => p.isHuman || p.id === parlorPartnerId)
  }

  const speakingId = activeSpeech?.playerId || ''

  const dialogue = (() => {
    if (!activeSpeech?.playerId || !activeSpeech?.text) return null
    const speaker = visiblePlayers.find((p) => p.id === activeSpeech.playerId)
    if (!speaker) return null
    const name = String(speaker.name || '').toUpperCase()
    const text = String(activeSpeech.text).replace(/\s+/g, ' ').trim()
    if (!text) return null
    return { name, text, isHuman: speaker.isHuman }
  })()

  return (
    <div className="castle-wrap">
      <svg viewBox="0 0 1600 900" className="castle-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="vignette" cx="50%" cy="42%" r="68%">
            <stop offset="50%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.7" />
          </radialGradient>

          <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="2" fill="#000" opacity="0.08" />
          </pattern>

        </defs>

        {/* room background */}
        {roomImage ? (
          <image
            href={roomImage}
            x="0" y="0" width="1600" height="900"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <rect width="1600" height="900" fill="#060410" />
        )}

        {/* dim overlay so sprites pop over busy backgrounds */}
        {roomImage && <rect width="1600" height="900" fill="#000" opacity="0.15" />}

        {/* Clawdia in turret — sprite */}
        {room === 'turret' && (
          <g transform="translate(610 560)">
            <ellipse cx="0" cy="56" rx="52" ry="18" fill="rgba(0,0,0,0.5)" />
            <foreignObject x={-80} y={-104} width={160} height={160}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                className="player-sprite"
                style={{
                  width: 160,
                  height: 160,
                  backgroundImage: `url(${BASE}sprites/clawdia.png)`,
                  backgroundSize: '480px 640px',
                  backgroundPosition: '-160px 0px',
                }}
              />
            </foreignObject>
            <text className="host-title" y="82" textAnchor="middle">CLAWDIA</text>
          </g>
        )}

        {isMorning && lastMurdered && room === 'breakfast' && (
          <g className="empty-chair-pulse">
            <rect x="1268" y="580" width="84" height="84" rx="4" fill="none" stroke="#ff2975" strokeWidth="2" />
          </g>
        )}

        {/* players */}
        {visiblePlayers.map((player, index) => {
          if (isMorning && lastMurdered && player.id === lastMurdered.id) return null
          const pos = playerPosition(player, index, room, visiblePlayers, parlorPartnerId)
          return (
            <PlayerToken
              key={player.id}
              player={player}
              x={pos.x}
              y={pos.y}
              isHuman={player.isHuman}
              isSpeaking={speakingId === player.id}
            />
          )
        })}

        {/* overlays */}
        <rect width="1600" height="900" fill="url(#vignette)" />
        <rect width="1600" height="900" fill="url(#scanlines)" />

        {/* room label bar */}
        <rect x="92" y="820" width="1416" height="42" rx="4" fill="rgba(6,4,16,0.9)" stroke="#ff2975" strokeWidth="1" opacity="0.5" />
        <text x="800" y="847" className="room-label" textAnchor="middle">{roomTitle(room, phase)}</text>
      </svg>

      {/* Hotline Miami-style dialogue bar — HTML overlay */}
      {dialogue && (
        <div className="dialogue-bar">
          <span className={`dialogue-name ${dialogue.isHuman ? 'you' : ''}`}>{dialogue.name}</span>
          <span className="dialogue-text">{dialogue.text}</span>
        </div>
      )}
    </div>
  )
}
