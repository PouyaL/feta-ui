'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { TrashIcon } from '@fetaui/react/rounded/trash'
import { duration, ease } from '../../motion-tokens'
import { cx, kit, LabelSwap, pressProps, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './add-to-cart-button.module.css'

const REPEAT_AFTER = 380
const REPEAT_SLOW = 150
const REPEAT_FAST = 55
const REPEAT_STEP = 0.8

export type AddToCartButtonProps = {
  label?: string
  /** Controlled quantity. 0 shows Add. */
  value?: number | undefined
  defaultValue?: number
  onValueChange?: (value: number) => void
  /** Default 9. */
  max?: number
  disabled?: boolean
  /** `false` turns off the width ease, the rolling count and the press scale. */
  animated?: boolean
  className?: string
}

function Step({ label, icon, off, onStep, still }: { label: string; icon: ReactNode; off: boolean; onStep: () => void; still: boolean }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const step = useRef(onStep)
  /** Set once a hold has repeated, so the click that ends the hold adds nothing. */
  const repeated = useRef(false)
  step.current = onStep
  const stop = (): void => clearTimeout(timer.current)

  useEffect(() => stop, [])
  useEffect(() => { if (off) stop() }, [off])

  // Holding repeats, speeding up from 150 ms to 55 ms.
  function start(e: PointerEvent<HTMLButtonElement>): void {
    if (e.button !== 0 || off) return
    repeated.current = false
    let wait = REPEAT_SLOW
    const run = (): void => {
      repeated.current = true
      step.current()
      wait = Math.max(REPEAT_FAST, wait * REPEAT_STEP)
      timer.current = setTimeout(run, wait)
    }
    timer.current = setTimeout(run, REPEAT_AFTER)
  }

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-disabled={off || undefined}
      className={cx(kit.control, styles.step)}
      onClick={() => { if (repeated.current) { repeated.current = false; return } if (!off) onStep() }}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      {...pressProps(still, off, 0.94)}
    >
      <span className={styles.stepIcon}>{icon}</span>
    </motion.button>
  )
}

/** Add opens into a quantity stepper in place. */
export function AddToCartButton({ label = 'Add', value, defaultValue = 0, onValueChange, max = 9, disabled, animated = true, className }: AddToCartButtonProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const [tip, setTip] = useState(false)
  const count = value ?? held
  const open = count > 0
  const atLimit = count >= max
  const latest = useRef(count)
  latest.current = count
  const root = useRef<HTMLDivElement>(null)
  const refocus = useRef(false)

  // Add and Remove replace the control that held the focus.
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    const buttons = root.current?.querySelectorAll('button')
    buttons?.item(buttons.length - 1).focus({ preventScroll: true })
  }, [open])

  function set(next: number): void {
    const clamped = Math.min(max, Math.max(0, next))
    latest.current = clamped
    setHeld(clamped)
    onValueChange?.(clamped)
  }

  const layout = still ? {} : { animate: { width: open ? 108 : 80 }, initial: false, transition: { duration: duration.width, ease: ease.out } }

  return (
    <motion.div
      ref={root}
      role={open ? 'group' : undefined}
      aria-label={open ? 'Quantity' : undefined}
      className={cx(styles.root, className)}
      style={still ? { width: open ? 108 : 80 } : {}}
      {...layout}
    >
      <AnimatePresence>
        {open && tip && atLimit ? (
          <motion.span role="status" className={styles.tip} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : 0.12 }}>
            Limit {max} per order
          </motion.span>
        ) : null}
      </AnimatePresence>
      {open ? (
        <div className={cx(styles.stepper, disabled && styles.off)} onPointerEnter={() => setTip(true)} onPointerLeave={() => setTip(false)} onFocus={() => setTip(true)} onBlur={() => setTip(false)}>
          <Step
            label={count === 1 ? 'Remove' : 'Decrease quantity'}
            icon={<LabelSwap swapKey={count === 1 ? 'bin' : 'minus'} still={still}>{count === 1 ? <TrashIcon /> : <MinusIcon />}</LabelSwap>}
            off={Boolean(disabled)}
            still={still}
            onStep={() => { refocus.current = latest.current === 1; set(latest.current - 1) }}
          />
          <span className={styles.count} aria-live="polite"><RollingText value={String(count)} still={still} /></span>
          <Step label="Increase quantity" icon={<PlusIcon />} off={Boolean(disabled) || atLimit} still={still} onStep={() => set(latest.current + 1)} />
        </div>
      ) : (
        <motion.button type="button" disabled={disabled} className={cx(kit.control, kit.surface, styles.add)} onClick={() => { refocus.current = true; set(1) }} {...pressProps(still, disabled)}>
          <span className={styles.stepIcon}><PlusIcon /></span>
          {label}
        </motion.button>
      )}
    </motion.div>
  )
}
