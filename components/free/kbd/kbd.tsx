'use client'
import { Children, Fragment, useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './kbd.module.css'

/** How long a sequence waits for its next key. */
const SEQUENCE_RESET_MS = 1500
const CHORD_STAGGER_MS = 40

const SPOKEN: Record<string, string> = {
  '⌘': 'Command', '⇧': 'Shift', '⌥': 'Option', '⌃': 'Control', '↵': 'Enter', '⌫': 'Backspace', '⇥': 'Tab', '⎋': 'Escape',
  '↑': 'Up', '↓': 'Down', '←': 'Left', '→': 'Right', '\\': 'Backslash', '/': 'Slash', '?': 'Question mark',
}

/** What `KeyboardEvent.key` reports for a cap. */
const EVENT_KEY: Record<string, string> = {
  '⌘': 'Meta', '⇧': 'Shift', '⌥': 'Alt', '⌃': 'Control', Ctrl: 'Control', '↵': 'Enter', Esc: 'Escape', '⎋': 'Escape', '⌫': 'Backspace', '⇥': 'Tab',
  '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight',
}

const matches = (cap: string, key: string): boolean => (EVENT_KEY[cap] ?? cap).toLowerCase() === key.toLowerCase()

export type KbdProps = Omit<HTMLAttributes<HTMLElement>, 'ref'> & {
  /** Outline on surfaces, Soft in tinted rows and footers, Inverse on dark tooltips. Default `outline`. */
  variant?: 'outline' | 'soft' | 'inverse'
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** For shortcut sheets that echo the keys being held. */
  pressed?: boolean
  disabled?: boolean
  /** Spoken name. Symbols like ⌘ have one already. */
  spoken?: string
  animated?: boolean
  ref?: Ref<HTMLElement>
}

/** A keycap. One key per cap. */
export function Kbd({ variant = 'outline', size = 'md', pressed = false, disabled = false, spoken, animated = true, className, children, ref, ...rest }: KbdProps) {
  const still = useStill(animated)
  const name = spoken ?? (typeof children === 'string' ? SPOKEN[children] : undefined)
  return (
    <kbd
      ref={ref}
      data-variant={variant}
      data-size={size}
      data-pressed={pressed ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-still={still ? '' : undefined}
      className={cx(styles.kbd, className)}
      {...rest}
    >
      {name ? <><span className={kit.srOnly}>{name}</span><span aria-hidden="true">{children}</span></> : children}
    </kbd>
  )
}

export type KbdGroupProps = Omit<HTMLAttributes<HTMLSpanElement>, 'ref'> & {
  /** Combo adds a plus, chord sets caps close, sequence joins them with then. Default `combo`. */
  kind?: 'combo' | 'chord' | 'sequence'
  /** Caps as text. Or pass `Kbd` children for full control. */
  keys?: string[]
  variant?: KbdProps['variant']
  size?: KbdProps['size']
  /** Caps sink as the person presses the same keys. For teaching moments only. */
  listen?: boolean
  animated?: boolean
  ref?: Ref<HTMLSpanElement>
}

/** Echoes real key presses: held caps for combos, the next expected cap for sequences. */
function useEcho(keys: string[] | undefined, kind: KbdGroupProps['kind'], enabled: boolean): { held: Set<number>; step: number } {
  const [held, setHeld] = useState<Set<number>>(new Set())
  const [step, setStep] = useState(0)
  const stepRef = useRef(0)
  useEffect(() => {
    if (!enabled || !keys) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const moveTo = (next: number): void => { stepRef.current = next; setStep(next) }
    function down(e: KeyboardEvent): void {
      if (kind === 'sequence') {
        if (!matches(keys?.[stepRef.current] ?? '', e.key)) return
        clearTimeout(timer)
        moveTo(stepRef.current + 1)
        timer = setTimeout(() => moveTo(0), SEQUENCE_RESET_MS)
        return
      }
      const i = keys?.findIndex((cap) => matches(cap, e.key)) ?? -1
      if (i >= 0) setHeld((prev) => new Set(prev).add(i))
    }
    function up(e: KeyboardEvent): void {
      // macOS sends no keyup for other keys while Command is held.
      if (e.key === 'Meta') { clear(); return }
      const i = keys?.findIndex((cap) => matches(cap, e.key)) ?? -1
      if (i >= 0) setHeld((prev) => { const next = new Set(prev); next.delete(i); return next })
    }
    const clear = (): void => setHeld(new Set())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [enabled, kind, keys?.join(' ')])
  return { held, step }
}

/** Caps that belong together. */
export function KbdGroup({ kind = 'combo', keys, variant, size, listen = false, animated = true, className, children, ref, ...rest }: KbdGroupProps) {
  const still = useStill(animated)
  const { held, step } = useEcho(keys, kind, listen)
  const caps: ReactNode[] = keys
    ? keys.map((cap, i) => (
      <Kbd
        key={i}
        {...(variant ? { variant } : {})}
        {...(size ? { size } : {})}
        animated={animated}
        pressed={kind === 'sequence' ? i < step : held.has(i)}
        style={{ '--cap-delay': `${still || kind !== 'chord' ? 0 : i * CHORD_STAGGER_MS}ms` } as HTMLAttributes<HTMLElement>['style']}
      >
        {cap}
      </Kbd>
    ))
    : Children.toArray(children)
  return (
    <span ref={ref} data-kind={kind} className={cx(styles.group, className)} {...rest}>
      {caps.map((cap, i) => (
        <Fragment key={i}>
          {i > 0 && kind === 'combo' ? <span className={styles.join} aria-hidden="true">+</span> : null}
          {i > 0 && kind === 'sequence' ? <span className={styles.join} data-faded={listen && step === i ? '' : undefined} data-still={still ? '' : undefined}>then</span> : null}
          {cap}
        </Fragment>
      ))}
    </span>
  )
}
