'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease, spring } from '../../motion-tokens'
import { FieldProvider, form } from '../form-kit/form-kit'
import { Label, type LabelProps } from '../label/label'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './field.module.css'

export type FieldProps = {
  label: ReactNode
  /** Help under the control. It is replaced by `error`. */
  description?: ReactNode
  /** Turns the field invalid and says what is wrong. */
  error?: ReactNode
  /** Shows a check, once the value was checked against something. */
  valid?: boolean
  required?: boolean
  disabled?: boolean
  /** Label in a 200 px column on Web. It stacks on Mobile. */
  horizontal?: boolean
  labelProps?: Omit<LabelProps, 'children' | 'htmlFor' | 'required' | 'invalid' | 'disabled' | 'focused' | 'animated'>
  animated?: boolean
  className?: string
  /** The control: Input, Textarea, Select or Combobox. */
  children: ReactNode
}

/** Ties a label, a control and help text together so they read and validate as one. */
export function Field({ label, description, error, valid, required, disabled, horizontal, labelProps, animated = true, className, children }: FieldProps) {
  const still = useStill(animated)
  const id = useId()
  const [focused, setFocused] = useState(false)
  const invalid = Boolean(error)
  const helpId = `${id}-help`
  const hasHelp = invalid || Boolean(description)

  return (
    <div
      className={cx(styles.field, className)}
      data-horizontal={horizontal ? '' : undefined}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}
    >
      <div className={styles.head}>
        <Label {...labelProps} htmlFor={`${id}-control`} required={Boolean(required)} invalid={invalid} disabled={Boolean(disabled)} focused={focused} animated={animated}>{label}</Label>
      </div>
      <div className={styles.body}>
        <FieldProvider value={{ id: `${id}-control`, describedBy: hasHelp ? helpId : undefined, invalid, disabled: Boolean(disabled), required: Boolean(required) }}>
          <div className={styles.control}>
            {children}
            <AnimatePresence initial={false}>
              {valid ? (
                <motion.span
                  key="valid"
                  className={styles.valid}
                  initial={still ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={still ? { duration: 0 } : spring.pop}
                >
                  <Tick02Icon trigger="none" />
                  <span className={form.srOnly}>Valid</span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </FieldProvider>
        {hasHelp ? (
          <div id={helpId} className={styles.help}>
            <AnimatePresence mode="wait" initial={false}>
              {invalid ? (
                <motion.span
                  key="error"
                  role="alert"
                  className={form.message}
                  initial={still ? false : { y: -4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: still ? 0 : duration.message, ease: ease.out }}
                >
                  <AlertCircleIcon trigger="none" /> {error}
                </motion.span>
              ) : <span key="help">{description}</span>}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </div>
  )
}
