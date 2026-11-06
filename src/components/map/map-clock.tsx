import { useEffect, useState } from 'react'

export function MapClock() {
  const [time, setTime] = useState(new Date())
  const [isZulu, setIsZulu] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const zuluTime = time.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
  })

  const limaTime = time.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  const displayTime = isZulu ? zuluTime : limaTime
  const zoneLabel = isZulu ? 'Z' : 'L'

  return (
    <button
      onClick={() => setIsZulu(!isZulu)}
      className="flex items-center justify-center font-mono text-[13px] bg-muted/40 hover:bg-muted/80 px-3.5 py-1 rounded-md border border-border shadow-sm transition-all select-none cursor-pointer"
      title={`Click to switch to ${isZulu ? 'Lima (Local)' : 'Zulu (UTC)'} time`}
    >
      <span className="tracking-wider text-muted-foreground">
        {displayTime}
        <span className="text-foreground font-semibold ml-0.5">
          {zoneLabel}
        </span>
      </span>
    </button>
  )
}