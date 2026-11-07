'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { EyeIcon } from '@fetaui/react/rounded/eye'
import { EyeOffIcon } from '@fetaui/react/rounded/eye-off'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { duration, ease } from '../../motion-tokens'
import { Tag, kit, useFlash } from '../data-kit/data-kit'
import styles from './api-key.module.css'

export type ApiKeyProps = {
  name: string
  /** The full key. Stays out of the DOM until revealed or copied. */
  value: string
  environment?: 'live' | 'test'
  /** Line under the key. */
  meta: string
  revoked?: boolean
  onRoll?: () => void
  animated?: boolean
  className?: string | undefined
}

const DOTS = '••••••••••••'
const mask = (value: string): string => `${value.slice(0, value.indexOf('_', 3) + 1)}${DOTS}${value.slice(-4)}`

/** One key on a 4% well. Hidden until revealed; Copied confirms for 2 s; Revoked removes the actions. */
export function ApiKey({ name, value, environment = 'live', meta, revoked = false, onRoll, animated = true, className }: ApiKeyProps) {
  const still = useStill(animated)
  const [shown, setShown] = useState(false)
  const [copied, flash] = useFlash()
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      flash()
    } catch {
      // Denied or unavailable: nothing was copied, so nothing confirms.
    }
  }
  const open = (shown || copied) && !revoked
  return (
    <article className={cx(styles.card, kit.enter, className)} data-still={still ? '' : undefined} data-revoked={revoked ? '' : undefined} aria-label={`${name} API key`}>
      <header className={styles.head}>
        <LockIcon size={16} aria-hidden="true" />
        <span className={styles.name}>{name}</span>
        {revoked ? <Tag tone="danger" mark>Revoked</Tag> : <Tag tone={environment === 'live' ? 'success' : 'warning'} mark>{environment === 'live' ? 'Live' : 'Test'}</Tag>}
      </header>
      <div className={styles.well}>
        <code className={styles.key}>{open ? value : mask(value)}</code>
        {revoked ? null : (
          <>
            <IconButton variant="ghost" size="sm" label={shown ? 'Hide key' : 'Reveal key'} aria-pressed={shown} icon={shown ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />} onClick={() => setShown(!shown)} animated={animated} />
            <span className={styles.copy}>
              <span role="status">
                <AnimatePresence initial={false}>
                  {copied ? <motion.span key="copied" className={styles.copied} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : duration.fast, ease: ease.out }}>Copied</motion.span> : null}
                </AnimatePresence>
              </span>
              {/* Stays mounted, so focus survives the confirmation. */}
              <IconButton variant="ghost" size="sm" label={copied ? 'Copied' : 'Copy key'} icon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />} onClick={() => void copy()} animated={animated} />
            </span>
          </>
        )}
      </div>
      <footer className={styles.foot}>
        <span>{meta}</span>
        {revoked ? null : <Button variant="ghost" size="sm" onClick={onRoll} animated={animated}>Roll key</Button>}
      </footer>
    </article>
  )
}
