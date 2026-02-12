const BASE = import.meta.env.BASE_URL

const NPC_SPRITES = [
  `${BASE}sprites/npc-0.png`,
  `${BASE}sprites/npc-1.png`,
  `${BASE}sprites/npc-2.png`,
  `${BASE}sprites/npc-3.png`,
  `${BASE}sprites/npc-4.png`,
  `${BASE}sprites/npc-5.png`,
  `${BASE}sprites/npc-6.png`,
]

const NEON_ACCENTS = ['#d480ff', '#40ffd0', '#ff6060', '#60a0ff', '#ff60c0', '#a0ff40', '#bf40ff']

function labelFor(player, isHuman) {
  const base = String(player?.name || '').toUpperCase()
  return isHuman ? `${base} (YOU)` : base
}

// Sprite sheet layout: 96x128 PNG = 3 columns x 4 rows of 32x32 frames
// Front-facing standing frame: column 1, row 0
const SCALE = 5
const FRAME = 32
const SHEET_W = 96
const SHEET_H = 128
const DISPLAY = FRAME * SCALE // 160

export default function PlayerToken({ player, x, y, isHuman, isSpeaking = false }) {
  const dead = !player.alive
  const idx = parseInt(String(player.id || '').replace(/\D/g, '') || '0', 10)

  const sprite = isHuman ? `${BASE}sprites/human.png` : NPC_SPRITES[idx % NPC_SPRITES.length]
  const neonAccent = isHuman ? '#ff2975' : NEON_ACCENTS[idx % NEON_ACCENTS.length]

  // Position sprite so feet land just above the shadow (y=56)
  const spriteY = 56 - DISPLAY // -104
  const spriteX = -DISPLAY / 2  // -80

  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        className={`player-token ${dead ? 'dead' : ''} ${isHuman ? 'human' : ''} ${isSpeaking ? 'speaking' : ''}`}
      >
        {/* shadow */}
        <ellipse className="player-shadow" cx="0" cy="56" rx="52" ry="18" />

        {/* neon ground glow */}
        <ellipse cx="0" cy="56" rx="60" ry="24" fill={neonAccent} opacity="0.06" />

        {/* speaking ring — neon pulse */}
        {isSpeaking && !dead && (
          <g className="player-speaking-ring">
            <circle cx="0" cy="-20" r="90" fill="none" stroke={neonAccent} strokeWidth="2.5" opacity="0.7" />
            <circle cx="0" cy="-20" r="100" fill="none" stroke={neonAccent} strokeWidth="1.5" opacity="0.3" />
          </g>
        )}

        {/* sprite via foreignObject */}
        <foreignObject x={spriteX} y={spriteY} width={DISPLAY} height={DISPLAY}>
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="player-sprite"
            style={{
              width: DISPLAY,
              height: DISPLAY,
              backgroundImage: `url(${sprite})`,
              backgroundSize: `${SHEET_W * SCALE}px ${SHEET_H * SCALE}px`,
              backgroundPosition: `${-FRAME * SCALE}px 0px`,
            }}
          />
        </foreignObject>

        {/* name label */}
        <text className="player-name" y="82" textAnchor="middle">{labelFor(player, isHuman)}</text>

        {/* model label */}
        {!isHuman && player.modelLabel && (
          <text className={`player-model tier-${(player.modelTier || '').toLowerCase()}`} y="100" textAnchor="middle">{player.modelLabel}</text>
        )}

        {/* dead cross — neon */}
        {dead && (
          <g className="player-cross">
            <line x1="-50" y1="-80" x2="50" y2="40" />
            <line x1="50" y1="-80" x2="-50" y2="40" />
          </g>
        )}
      </g>
    </g>
  )
}
