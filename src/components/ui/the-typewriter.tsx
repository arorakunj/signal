import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface TextTypewriterProps {
  children: string
  className?: string
  duration?: number
  delay?: number
  play?: boolean
  onComplete?: () => void
}

export default function TextTypewriter({
  children,
  className,
  duration = 1.5,
  delay = 0,
  play = true,
  onComplete,
}: TextTypewriterProps) {
  const reducedMotion = useReducedMotion()
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const length = Array.from(children).length
  const isPlaying = play && !reducedMotion && count < length

  useEffect(() => {
    if (!play || reducedMotion || length === 0) return
    let frame = 0
    const startTime = performance.now() + delay * 1000

    function tick(now: number) {
      if (now >= startTime) {
        const progress = duration <= 0 ? 1 : (now - startTime) / (duration * 1000)
        const next = Math.min(length, Math.floor(progress * length))
        setStarted(true)
        setCount(next)
        if (next === length) {
          onComplete?.()
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [delay, duration, length, onComplete, play, reducedMotion])

  return (
    <span className={cn('relative inline-grid max-w-full', className)} data-typing={isPlaying || undefined}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true" className={cn('col-start-1 row-start-1', isPlaying && 'invisible')}>
        {children}
      </span>
      {isPlaying && (
        <span aria-hidden="true" className="col-start-1 row-start-1 text-left">
          {Array.from(children).slice(0, count).join('')}
          {started && (
            <motion.span
              className="absolute ml-[0.055em] mt-[0.05em] inline-block h-[0.78em] w-[0.035em] min-w-px bg-current"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
            />
          )}
        </span>
      )}
    </span>
  )
}
