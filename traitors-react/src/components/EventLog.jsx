import { useEffect, useRef } from 'react'

export default function EventLog({ entries }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  if (!entries.length) return null

  return (
    <div className="event-log">
      {entries.map((entry, i) => (
        <div className="log-entry" key={i}>
          <span className="log-label">{entry.label}</span>
          <span className="log-text">{entry.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
