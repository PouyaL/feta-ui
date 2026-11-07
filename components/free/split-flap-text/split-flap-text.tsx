'use client'
import { useEffect, useRef, useState } from 'react'
import { cx, useStill } from '../motion-kit/motion-kit'
import { TextShell } from '../text-shell/text-shell'
import styles from './split-flap-text.module.css'

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const FLIP_MS = 70
const STAGGER_FLIPS = 2

export type SplitFlapTextProps = {
  /** Uppercase letters, digits and spaces flip. Anything else lands at once. It pads to `cells`. */
  text: string
  /** Cells on the board. Default 12. */
  cells?: number
  styleKind?: 'soft' | 'original'
  animated?: boolean
  className?: string
}

const pad = (text: string, cells: number): string => text.toUpperCase().slice(0, cells).padEnd(cells, ' ')

/** An airport board: each cell flips through the alphabet until it lands. */
export function SplitFlapText({ text, cells = 12, styleKind = 'soft', animated = true, className }: SplitFlapTextProps) {
  const still = useStill(animated)
  const target = pad(text, cells)
  const [shown, setShown] = useState(target)
  const [flipping, setFlipping] = useState(false)
  const board = useRef(target)

  useEffect(() => {
    if (still) { board.current = target; setShown(target); setFlipping(false); return }
    let tick = 0
    setFlipping(true)
    const timer = setInterval(() => {
      tick += 1
      let done = true
      board.current = Array.from(board.current).map((char, i) => {
        const want = target[i] ?? ' '
        if (char === want || tick < i * STAGGER_FLIPS) { if (char !== want) done = false; return char }
        done = false
        if (!CHARS.includes(want)) return want
        return CHARS[(CHARS.indexOf(char) + 1) % CHARS.length] ?? ' '
      }).join('')
      setShown(board.current)
      if (done) { clearInterval(timer); setFlipping(false) }
    }, FLIP_MS)
    return () => clearInterval(timer)
  }, [target, still])

  const row = (
    <span role="img" aria-label={text} className={styles.board} data-still={still ? '' : undefined}>
      {Array.from(shown).map((char, i) => (
        <span key={`${i}-${char}`} aria-hidden="true" className={styles.cell} data-flip={char !== target[i] ? '' : undefined}>
          <span className={styles.char}>{char === ' ' ? ' ' : char}</span>
        </span>
      ))}
    </span>
  )
  if (styleKind === 'original') return <span className={className}>{row}</span>
  return <TextShell name="Split Flap Text" state={flipping ? 'flipping' : text.toLowerCase()} className={cx(className)}>{row}</TextShell>
}
