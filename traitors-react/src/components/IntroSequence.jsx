import { useState, useEffect, useCallback } from 'react'

const CHAR_DELAY = 28

function getIntroLines(name) {
  return [
    `Welcome to the castle, ${name}. I'm Clawdia. Here's the situation: you are the only human in this game. The other six players? All AI. And they know it. They know one of the seven isn't like them — and they're going to find you.`,
    `Each round has four parts. First, breakfast — that's casual. Everyone chats, gets a feel for each other. Then you'll be pulled aside for a private one-on-one with one of them. After that, the Round Table — that's where it gets serious. They'll lay out their cases, challenge each other, and try to work out who doesn't belong. Then they vote. Whoever gets the most votes is banished.`,
    `After the vote, night falls. You're the Traitor, so you get to murder one AI in the Turret. That's how you thin their numbers. You win if you make it to the final two. They win if they banish you first.`,
    `One more thing — each AI is powered by a different model. You can see which one in the roster. Some are sharper than others. You might want to think about that when you're deciding who to murder. Good luck, darling.`,
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
