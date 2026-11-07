'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { cx, kit, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './command-button.module.css'

export type CommandButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  label?: string
  icon?: ReactNode
  /** The letter of the shortcut. Default `k`. */
  shortcutKey?: string
  /** Leave it out to detect it from the browser. */
  os?: 'mac' | 'windows' | undefined
  /** `false` turns off the press scale and the sinking keys. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** A button with its shortcut drawn as keycaps that sink as the real keys go down. */
export function CommandButton({ label = 'Search', icon, shortcutKey = 'k', os, animated = true, className, disabled, type = 'button', ref, ...rest }: CommandButtonProps) {
  const still = useStill(animated)
  const inner = useRef<HTMLButtonElement | null>(null)
  const [detected, setDetected] = useState<'mac' | 'windows'>('mac')
  const [mod, setMod] = useState(false)
  const [letter, setLetter] = useState(false)
  const system = os ?? detected

  useEffect(() => { if (!/mac|iphone|ipad/i.test(navigator.platform)) setDetected('windows') }, [])

  useEffect(() => {
    if (disabled) return
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Meta' || e.key === 'Control') setMod(true)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcutKey.toLowerCase()) {
        e.preventDefault()
        setLetter(true)
        if (!e.repeat) inner.current?.click()
      }
    }
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'Meta' || e.key === 'Control') { setMod(false); setLetter(false) }
      if (e.key.toLowerCase() === shortcutKey.toLowerCase()) setLetter(false)
    }
    const reset = (): void => { setMod(false); setLetter(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [disabled, shortcutKey])

  const keys: [string, boolean][] = [[system === 'mac' ? '⌘' : 'Ctrl', mod], [shortcutKey.toUpperCase(), letter]]

  return (
    <motion.button
      ref={(node: HTMLButtonElement | null) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      type={type}
      disabled={disabled}
      aria-keyshortcuts={`${system === 'mac' ? 'Meta' : 'Control'}+${shortcutKey.toUpperCase()}`}
      className={cx(kit.control, kit.surface, styles.button, className)}
      {...pressProps(still, disabled)}
      {...rest}
    >
      {icon ? <span className={kit.icon}>{icon}</span> : null}
      {label}
      <span className={styles.keys} aria-hidden="true">
        {keys.map(([key, down]) => (
          <span key={key} className={styles.wrap}>
            <kbd className={styles.cap} data-down={down && !still ? '' : undefined}>{key}</kbd>
          </span>
        ))}
      </span>
    </motion.button>
  )
}
