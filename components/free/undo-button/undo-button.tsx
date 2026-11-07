'use client'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { UndoIcon } from '@fetaui/react/rounded/undo'
import { duration, ease } from '../../motion-tokens'
import { cx, kit, LabelSwap, pressProps, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './undo-button.module.css'

const DONE_MS = 2400

export type UndoButtonProps = {
  label?: string
  /** Shown once the action runs. */
  doneLabel?: string
  icon?: ReactNode
  /** Seconds to take it back. Default 5. */
  seconds?: number
  /** Fires when the window closes, or when the button unmounts during it. Run the real action here. */
  onCommit?: () => void
  onUndo?: () => void
  disabled?: boolean
  /** `false` turns off the width ease and the rolling count. The bar still drains: it is information. */
  animated?: boolean
  className?: string
}

type State = 'idle' | 'pending' | 'done'

/** An action with a window to take it back. */
export function UndoButton({ label = 'Archive', doneLabel = 'Archived', icon, seconds = duration.undo, onCommit, onUndo, disabled, animated = true, className }: UndoButtonProps) {
  const still = useStill(animated)
  const [state, setState] = useState<State>('idle')
  const [left, setLeft] = useState(seconds)
  const undoRef = useRef<HTMLButtonElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  const commit = useRef(onCommit)
  commit.current = onCommit
  const pendingRef = useRef(false)
  pendingRef.current = state === 'pending'
  const [mac, setMac] = useState(true)

  // Read after mount so the server and the first client render agree.
  useEffect(() => {
    setMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent))
  }, [])

  // Leaving the page during the window still runs the action: only Undo cancels it.
  useEffect(() => () => { if (pendingRef.current) commit.current?.() }, [])

  useEffect(() => {
    if (state !== 'pending') return
    undoRef.current?.focus({ preventScroll: true })
    const end = Date.now() + seconds * 1000
    const tick = setInterval(() => setLeft(Math.max(1, Math.ceil((end - Date.now()) / 1000))), 100)
    const done = setTimeout(() => { refocus.current = document.activeElement === undoRef.current; pendingRef.current = false; setState('done'); commit.current?.() }, seconds * 1000)
    return () => { clearInterval(tick); clearTimeout(done) }
  }, [state, seconds])

  useEffect(() => {
    if (state === 'done') {
      const reset = setTimeout(() => setState('idle'), DONE_MS)
      return () => clearTimeout(reset)
    }
    if (state === 'idle' && refocus.current) {
      refocus.current = false
      startRef.current?.focus({ preventScroll: true })
    }
  }, [state])

  function undo(): void {
    refocus.current = true
    pendingRef.current = false
    setState('idle')
    onUndo?.()
  }

  useEffect(() => {
    if (state !== 'pending') return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const layout = still ? {} : { layout: true as const, transition: { layout: { duration: duration.width, ease: ease.out } } }

  if (state === 'idle') {
    return (
      <motion.button
        ref={startRef}
        type="button"
        disabled={disabled}
        className={cx(kit.control, kit.surface, styles.shell, className)}
        style={{ borderRadius: 9999 }}
        onClick={() => { setLeft(seconds); setState('pending') }}
        {...layout}
        {...pressProps(still, disabled)}
      >
        {icon ? <span className={kit.icon}>{icon}</span> : null}
        <LabelSwap swapKey="idle" still={still}>{label}</LabelSwap>
      </motion.button>
    )
  }

  if (state === 'done') {
    return (
      <motion.div role="status" className={cx(styles.shell, styles.done, className)} style={{ borderRadius: 9999 }} {...layout}>
        <span className={kit.icon}><Tick02Icon /></span>
        <LabelSwap swapKey="done" still={still}>{doneLabel}</LabelSwap>
      </motion.div>
    )
  }

  return (
    <motion.div role="group" aria-label={`${doneLabel}. Undo available`} className={cx(styles.shell, styles.pending, className)} style={{ borderRadius: 9999 }} {...layout}>
      <span className={styles.pendingLabel}><LabelSwap swapKey="pending" still={still}>{doneLabel}</LabelSwap></span>
      <span className={styles.divider} aria-hidden="true" />
      <button ref={undoRef} type="button" className={cx(kit.control, styles.undo)} onClick={undo}>
        <span className={styles.undoIcon}><UndoIcon /></span>
        Undo
        <span className={styles.seconds}><RollingText value={String(left)} still={still} /></span>
      </button>
      <kbd className={styles.kbd} aria-hidden="true">{mac ? '⌘Z' : 'Ctrl Z'}</kbd>
      <span data-keep-motion="" className={styles.bar} style={{ animationDuration: `${seconds}s` }} aria-hidden="true" />
    </motion.div>
  )
}
