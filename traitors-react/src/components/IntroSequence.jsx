import { useState, useEffect, useCallback } from 'react'

const CHAR_DELAY = 28

function getIntroLines(name) {
  return [
    `Welcome to the castle, ${name}. I'm Clawdia Winkelman, and tonight, deception is the whole game. You are the only human here — and you're the Traitor. The other six players are AI Faithful, and they're hunting for one thing: the non-AI player.`,
    `Every round has four beats: breakfast chatter, Round Table accusations, the banishment vote, and then the Turret — where you murder one Faithful. Watch them talk to each other first. Learn their rhythms. Then step in.`,
    `You win by reaching the final two still hidden. They win if they banish you first. Keep your story coherent. Keep your nerves invisible. Good luck, darling.`,
  ]
}

const BASE = import.meta.env.BASE_URL

function ClawdiaAvatar({ speaking }) {
  return (
    <div className={`clawdia-avatar ${speaking ? 'speaking' : ''}`}>
      <div
        className="player-sprite"
        style={{
          width: 160,
          height: 160,
          backgroundImage: `url(${BASE}sprites/clawdia.png)`,
          backgroundSize: '480px 640px',
          backgroundPosition: '-160px 0px',
        }}
      />
    </div>
  )
}

export default function IntroSequence({ playerName, onComplete }) {
  const lines = getIntroLines(playerName)
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [skipped, setSkipped] = useState(false)

  const currentLine = lines[lineIndex] || ''
  const displayText = skipped ? currentLine : currentLine.slice(0, charIndex)
  const isLineComplete = skipped || charIndex >= currentLine.length
  const isLastLine = lineIndex >= lines.length - 1

  useEffect(() => {
    if (skipped || charIndex >= currentLine.length) return
    const timer = setTimeout(() => setCharIndex(c => c + 1), CHAR_DELAY)
    return () => clearTimeout(timer)
  }, [charIndex, currentLine, skipped])

  const advance = useCallback(() => {
    if (!isLineComplete) {
      setSkipped(true)
      return
    }
    if (isLastLine) {
      onComplete()
      return
    }
    setLineIndex(i => i + 1)
    setCharIndex(0)
    setSkipped(false)
  }, [isLineComplete, isLastLine, onComplete])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Enter' || e.key === ' ') advance()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [advance])

  return (
    <div className="intro-overlay" onClick={advance}>
      <div className="intro-scene">
        <ClawdiaAvatar speaking={!isLineComplete} />
        <div className="intro-dialogue">
          <div className="intro-speaker">Clawdia Winkelman</div>
          <div className="intro-speech">
            {displayText}
            {!isLineComplete && <span className="typewriter-cursor">|</span>}
          </div>
          <div className="intro-prompt">
            {isLastLine && isLineComplete ? 'click to begin' : 'click to continue'}
          </div>
        </div>
      </div>
    </div>
  )
}
