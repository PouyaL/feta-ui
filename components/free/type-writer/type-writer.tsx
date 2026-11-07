'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import { TextShell } from '../text-shell/text-shell'
import styles from './type-writer.module.css'

const TYPE_MS = 70
const ERASE_MS = 35
const HOLD_MS = 1400
const SELECT_MS = 500

export type TypeWriterStep = {
  text: string
  /** A wrong letter typed at this index, then erased. */
  typoAt?: number
  /** `select` highlights the word before replacing it. Default erase. */
  leave?: 'erase' | 'select'
}

export type TypeWriterProps = {
  steps: (string | TypeWriterStep)[]
  /** Style Soft puts it in the shell. Default `soft`. */
  styleKind?: 'soft' | 'original'
  loop?: boolean
  animated?: boolean
  className?: string
}

const normal = (step: string | TypeWriterStep | undefined): TypeWriterStep => (typeof step === 'string' ? { text: step } : step ?? { text: '' })

/** Types words like a person: typos, a selection and a blinking caret. */
export function TypeWriter({ steps, styleKind = 'soft', loop = true, animated = true, className }: TypeWriterProps) {
  const still = useStill(animated)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'typing' | 'typo' | 'selecting' | 'idle'>('typing')
  const all = steps.map(normal).map((step) => step.text).join(', ')
  const key = steps.map(normal).map((step) => step.text).join('|')
  // Off screen the typing waits, so no timers run until it scrolls back.
  const onscreen = useRef(true)
  const wake = useRef<(() => void) | null>(null)
  const observer = useRef<IntersectionObserver | null>(null)
  const watch = useCallback((node: HTMLSpanElement | null): (() => void) | undefined => {
    if (!node) return undefined
    const stopCss = watchOffscreen(node)
    observer.current = new IntersectionObserver(([entry]) => {
      onscreen.current = entry?.isIntersecting ?? true
      if (onscreen.current) { wake.current?.(); wake.current = null }
    })
    observer.current.observe(node)
    return () => { stopCss(); observer.current?.disconnect(); onscreen.current = true }
  }, [])

  useEffect(() => {
    if (still) return
    let alive = true
    const wait = async (ms: number): Promise<void> => {
      await new Promise((done) => setTimeout(done, ms))
      if (alive && !onscreen.current) await new Promise<void>((done) => { wake.current = done })
    }
    async function run(): Promise<void> {
      for (let index = 0; alive; index = loop ? (index + 1) % steps.length : index + 1) {
        const step = steps.length > index ? normal(steps[index]) : null
        if (!step) { setPhase('idle'); return }
        setPhase('typing')
        for (let i = 1; i <= step.text.length && alive; i += 1) {
          if (step.typoAt === i - 1) {
            setPhase('typo')
            setText(`${step.text.slice(0, i - 1)}o`)
            await wait(TYPE_MS * 4)
            setPhase('typing')
          }
          setText(step.text.slice(0, i))
          await wait(TYPE_MS)
        }
        setPhase('idle')
        await wait(HOLD_MS)
        if (!loop && index === steps.length - 1) return
        if (step.leave === 'select') {
          setPhase('selecting')
          await wait(SELECT_MS)
          setText('')
        } else {
          for (let i = step.text.length; i >= 0 && alive; i -= 1) {
            setText(step.text.slice(0, i))
            await wait(ERASE_MS)
          }
        }
      }
    }
    void run()
    return () => { alive = false; wake.current?.(); wake.current = null }
  }, [still, loop, key])

  const shown = still ? normal(steps.at(-1)).text : text
  const line = (
    <span ref={watch} className={styles.text} data-loop="">
      <span className={styles.srOnly}>{all}</span>
      <span aria-hidden="true" data-selected={phase === 'selecting' ? '' : undefined} className={styles.word}>{shown}</span>
      <span aria-hidden="true" className={styles.caret} data-off={still ? '' : undefined} data-solid={phase === 'typing' || phase === 'typo' ? '' : undefined} />
    </span>
  )
  if (styleKind === 'original') return <span className={className}>{line}</span>
  return <TextShell name="Type Writer" state={still ? 'idle' : phase} className={cx(className)}>{line}</TextShell>
}
