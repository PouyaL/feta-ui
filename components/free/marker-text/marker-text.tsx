'use client'
import { motion, useInView } from 'motion/react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { RotateCcwIcon } from '@fetaui/react/rounded/rotate-ccw'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { TextShell } from '../text-shell/text-shell'
import styles from './marker-text.module.css'

const STEP_S = 0.6
const STEP_GAP_S = 0.12

export type MarkKind = 'highlight' | 'underline' | 'circle' | 'box' | 'strike'
export type MarkerPart = string | { text: string; mark: MarkKind }

export type MarkerTextProps = {
  heading?: MarkerPart[]
  body?: MarkerPart[]
  styleKind?: 'soft' | 'original'
  /** Draws once in view. A Replay button appears after. */
  replay?: boolean
  animated?: boolean
  className?: string
}

/** Marks drawn by hand over copy, one after another: highlight, underline, circle, box and strike. */
export function MarkerText({ heading = [], body = [], styleKind = 'soft', replay = true, animated = true, className }: MarkerTextProps) {
  const still = useStill(animated)
  const root = useRef<HTMLDivElement>(null)
  const seen = useInView(root, { once: true })
  const [run, setRun] = useState(0)
  const [state, setState] = useState<'unmarked' | 'drawing' | 'marked'>('unmarked')
  const count = [...heading, ...body].filter((part) => typeof part !== 'string').length

  useEffect(() => {
    if (still) { setState('marked'); return }
    if (!seen) return
    setState('drawing')
    const timer = setTimeout(() => setState('marked'), (count * (STEP_S + STEP_GAP_S)) * 1000)
    return () => clearTimeout(timer)
  }, [run, count, still, seen])

  let order = 0
  const render = (parts: MarkerPart[]): ReactNode => parts.map((part, i) => {
    if (typeof part === 'string') return <Fragment key={i}>{part}</Fragment>
    const delay = order * (STEP_S + STEP_GAP_S)
    order += 1
    const line = part.mark === 'highlight' ? null : part.mark
    return (
      <span key={`${run}-${i}`} className={styles.mark} data-mark={part.mark} style={{ animationDelay: `${delay}s`, animationPlayState: seen ? 'running' : 'paused' }} data-still={still ? '' : undefined}>
        {part.text}
        {line ? (
          <svg aria-hidden="true" className={styles.draw} viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.path
              d={line === 'circle' ? 'M50 4C22 2 2 22 4 50s30 46 58 44 38-26 34-50S70 2 44 6' : line === 'box' ? 'M3 4H97V96H3Z' : line === 'strike' ? 'M0 54C30 48 66 58 100 50' : 'M0 92C30 84 66 98 100 88'}
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              initial={still ? false : { pathLength: 0 }}
              animate={{ pathLength: seen || still ? 1 : 0 }}
              transition={{ duration: still ? 0 : STEP_S, delay: still ? 0 : delay, ease: 'easeInOut' }}
            />
          </svg>
        ) : null}
      </span>
    )
  })

  const copy = (
    <div ref={root} className={styles.copy}>
      {heading.length ? <p className={styles.heading}>{render(heading)}</p> : null}
      {body.length ? <p className={styles.body}>{render(body)}</p> : null}
      {replay && state === 'marked' && !still ? <div className={styles.replay}><Button variant="ghost" size="sm" animated={animated} leadingIcon={<RotateCcwIcon />} onClick={() => setRun(run + 1)}>Replay</Button></div> : null}
    </div>
  )
  if (styleKind === 'original') return <div className={className}>{copy}</div>
  return <TextShell name="Marker Text" state={state} className={cx(className)}>{copy}</TextShell>
}
