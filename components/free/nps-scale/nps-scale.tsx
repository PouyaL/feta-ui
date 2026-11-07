'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type HTMLAttributes } from 'react'
import { Button } from '../button/button'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './nps-scale.module.css'

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const UPDATE_S = 0.24
const STANDARD = [0.25, 0.1, 0.25, 1] as const

export type NpsScaleProps = Omit<HTMLAttributes<HTMLElement>, 'onSubmit' | 'defaultValue'> & {
  question: string
  /** Default `Not likely`. */
  low?: string
  /** Default `Very likely`. */
  high?: string
  defaultValue?: number
  onSubmit?: (score: number) => void
  animated?: boolean
}

/** Eleven equal boxes. Choosing one inverts it and reveals Submit. */
export function NpsScale({ question, low = 'Not likely', high = 'Very likely', defaultValue, onSubmit, animated = true, className, ...rest }: NpsScaleProps) {
  const still = useStill(animated)
  const id = useId()
  const [score, setScore] = useState(defaultValue)
  return (
    <section data-still={animated ? undefined : ''} className={cx(styles.nps, className)} {...rest}>
      <h3 id={id} className={styles.question}>{question}</h3>
      <div role="radiogroup" aria-labelledby={id} className={styles.scale}>
        {SCORES.map((n) => (
          <label key={n} className={styles.box} data-on={score === n ? '' : undefined}>
            <input className={kit.srOnly} type="radio" name={id} value={n} checked={score === n} onChange={() => setScore(n)} aria-label={n === 0 ? `0, ${low}` : n === 10 ? `10, ${high}` : String(n)} />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
      <div className={styles.ends} aria-hidden="true"><span>{low}</span><span>{high}</span></div>
      <AnimatePresence initial={false}>
        {score === undefined ? null : (
          <motion.div className={styles.result} {...(still ? {} : { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, transition: { duration: UPDATE_S, ease: STANDARD } })}>
            <span role="status">You picked {score}</span>
            <Button size="sm" animated={animated} onClick={() => onSubmit?.(score)}>Submit</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
