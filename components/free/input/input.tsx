'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { EyeIcon } from '@fetaui/react/rounded/eye'
import { EyeOffIcon } from '@fetaui/react/rounded/eye-off'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease, spring } from '../../motion-tokens'
import { form, useFieldControl } from '../form-kit/form-kit'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './input.module.css'

const COPIED_MS = 2000
const LEVELS = ['Weak', 'Fair', 'Good', 'Strong'] as const

export type InputProps = Omit<ComponentProps<'input'>, 'size' | 'ref'> & {
  /** 32, 40, 48 on Web and 40, 48, 56 on Mobile. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  invalid?: boolean
  /** Before the value: an icon, or a mono prefix. */
  leading?: ReactNode
  /** Adds a labelled copy button. */
  copyable?: boolean
  /** Password strength, 0 to 4. Shows the meter under the field. */
  strength?: number
  animated?: boolean
  ref?: Ref<HTMLInputElement>
}

/** The single line text control: a pill that lifts onto the surface when focused. */
export function Input({ size = 'md', invalid, leading, copyable, strength, type = 'text', animated = true, className, id, disabled, required, value, defaultValue, 'aria-describedby': describedBy, ref, ...rest }: InputProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled, required, describedBy })
  const inner = useRef<HTMLInputElement | null>(null)
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const password = type === 'password'

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  function copy(): void {
    navigator.clipboard?.writeText(inner.current?.value ?? '').then(() => setCopied(true), () => undefined)
  }

  const end = password || copyable
  return (
    <span className={cx(styles.wrap, className)}>
      <span
        className={cx(form.pill, styles.control)}
        data-size={size}
        data-end={end ? '' : undefined}
        data-invalid={field.invalid ? '' : undefined}
        data-disabled={field.disabled ? '' : undefined}
        data-still={still ? '' : undefined}
      >
        {leading ? <span className={form.quiet}>{leading}</span> : null}
        <input
          {...rest}
          {...field.a11y}
          ref={(node) => {
            inner.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          id={field.id}
          type={password && shown ? 'text' : type}
          disabled={field.disabled}
          required={field.required}
          aria-required={field.required || undefined}
          aria-describedby={field.describedBy}
          {...(value === undefined ? {} : { value })}
          {...(defaultValue === undefined ? {} : { defaultValue })}
          className={cx(form.entry, styles.entry)}
        />
        <AnimatePresence initial={false}>
          {field.invalid ? (
            <motion.span
              key="alert"
              className={form.danger}
              initial={still ? false : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: still ? 0 : duration.fast, ease: ease.out }}
            >
              <AlertCircleIcon trigger="none" />
            </motion.span>
          ) : null}
        </AnimatePresence>
        {password ? (
          <IconButton
            variant="ghost"
            size="sm"
            animated={animated}
            label={shown ? 'Hide password' : 'Show password'}
            disabled={field.disabled}
            className={styles.action}
            icon={shown ? <EyeOffIcon /> : <EyeIcon />}
            onClick={() => setShown(!shown)}
          />
        ) : null}
        {copyable ? (
          <IconButton
            variant="ghost"
            size="sm"
            animated={animated}
            label={copied ? 'Copied' : 'Copy'}
            disabled={field.disabled}
            className={styles.action}
            icon={copied ? <motion.span className={styles.tick} initial={still ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={spring.pop}><Tick02Icon trigger="none" /></motion.span> : <CopyIcon />}
            onClick={copy}
          />
        ) : null}
      </span>
      {strength === undefined ? null : (
        <span className={styles.meter} data-level={strength} data-still={still ? '' : undefined}>
          <span className={styles.bars} aria-hidden="true">
            {[1, 2, 3, 4].map((bar) => <span key={bar} className={styles.bar} data-on={bar <= strength ? '' : undefined} />)}
          </span>
          <span className={styles.level} role="status">{strength > 0 ? LEVELS[strength - 1] : ''}</span>
        </span>
      )}
    </span>
  )
}
