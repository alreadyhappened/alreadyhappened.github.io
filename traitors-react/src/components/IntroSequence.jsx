import { useState, useEffect, useCallback } from 'react'
import HostDialogue from './HostDialogue'

const CHAR_DELAY = 35

function getIntroLines(name) {
  return [
    `Welcome to the castle, ${name}. I'm Clawdia Winkelman. Tonight, deception is the whole game.`,
    `In this format, you are the only human and also the Traitor. The other seven players are AI Faithful hunting for one thing: the non-AI player.`,
    `That means if you simply announce who you are, they will not believe you. They expect bluffing, reverse-bluffing, and panic theatre.`,
    `Every round has four beats: breakfast chatter, Round Table accusations, the banishment vote, and then the Turret where you murder one player.`,
    `You win by reaching the final two still hidden. They win if they banish you first. Keep your story coherent. Keep your nerves invisible.`,
    `Watch them talk to each other first. Learn their rhythms. Then step in.`,
  ]
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
      // Skip to full line
      setSkipped(true)
      return
    }
    if (isLastLine) {
      onComplete()
      return
    }
    // Next line
    setLineIndex(i => i + 1)
    setCharIndex(0)
    setSkipped(false)
  }, [isLineComplete, isLastLine, onComplete])

  // Click anywhere to advance
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Enter' || e.key === ' ') advance()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [advance])

  return (
    <div className="intro-overlay" onClick={advance}>
      <HostDialogue
        text={
          <>
            {displayText}
            {!isLineComplete && <span className="typewriter-cursor">|</span>}
          </>
        }
        onContinue={advance}
        showContinue={isLineComplete}
        large={true}
      />
      <div className="intro-hint">
        {isLastLine && isLineComplete ? 'click to begin' : 'click to continue'}
      </div>
    </div>
  )
}
