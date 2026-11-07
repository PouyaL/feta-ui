'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { COOKIE_CATEGORIES, CookiePreferences, type CookieCategory, type CookieChoices } from '../cookie-preferences/cookie-preferences'
import styles from './cookie-banner.module.css'

/** Enter 240 ms, y 16 to 0. Exit 180 ms. Saved crossfades in 200 ms and hides after 4 s. */
const ENTER = 0.24
const EXIT = 0.18
const FADE = 0.2
const RISE = 16
const SAVED_HOLD = 4000
const EASE_IN = [0.4, 0, 1, 1] as const

export type CookieBannerProps = {
  /** The long copy. */
  message?: ReactNode
  /** One line with a policy link. */
  compact?: boolean
  /** The line on `compact`. */
  compactMessage?: ReactNode
  policyHref?: string
  /** Pins it to the bottom of the page. `false` keeps it in the flow. Default `true`. */
  fixed?: boolean
  categories?: CookieCategory[]
  /** Starts on Saved with these choices. */
  defaultChoices?: CookieChoices
  /** Runs for every answer. Load optional cookies only after this. A rejection keeps the question and shows `failedMessage`. */
  onChoose?: (choices: CookieChoices) => Promise<void> | void
  /** Shown under the question when `onChoose` rejects. */
  failedMessage?: ReactNode
  /** Milliseconds on Saved before it hides. `0` keeps it. Default 4000. */
  savedHold?: number
  /** Fires once it has left. */
  onHidden?: () => void
  animated?: boolean
  className?: string
}

function summary(choices: CookieChoices, categories: CookieCategory[]): string {
  const on = categories.filter(({ id, locked }) => !locked && choices.includes(id)).map(({ title }) => title)
  const names = ['Essential', ...on]
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are on.` : 'Only essential cookies are on.'
  return `${list} Change this any time in the footer.`
}

/** Asks once. Reject all and Accept all carry the same weight, and Customize opens the preferences. */
export function CookieBanner({
  message = 'We use essential cookies to run this site. With your OK, we\'d also use optional ones to remember settings and learn what helps.', compact = false, compactMessage = 'We use cookies.', policyHref = '#', fixed = true,
  categories = COOKIE_CATEGORIES, defaultChoices, onChoose, failedMessage = 'Could not save your choices. Try again.', savedHold = SAVED_HOLD, onHidden, animated = true, className,
}: CookieBannerProps) {
  const still = useStill(animated)
  const id = useId()
  const [shown, setShown] = useState(true)
  const [choices, setChoices] = useState<CookieChoices | null>(defaultChoices ?? null)
  const [preferring, setPreferring] = useState(false)
  const [busy, setBusy] = useState(false)
  // Which answer is being saved, so only that button spins.
  const [pressed, setPressed] = useState<'reject' | 'accept'>('accept')
  const [failed, setFailed] = useState(false)
  const customize = useRef<HTMLButtonElement>(null)
  const saved = choices !== null
  const optional = categories.filter(({ locked }) => !locked).map((item) => item.id)
  const locked = categories.filter((item) => item.locked).map((item) => item.id)

  useEffect(() => {
    if (!saved || !savedHold || preferring) return
    const timer = setTimeout(() => setShown(false), savedHold)
    return () => clearTimeout(timer)
  }, [saved, savedHold, preferring])

  async function answer(next: CookieChoices): Promise<void> {
    setBusy(true)
    setFailed(false)
    try {
      await onChoose?.(next)
      setChoices(next)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const fade = { initial: still ? false : { opacity: 0 }, animate: { opacity: 1 }, exit: still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }, transition: { duration: FADE, ease: ease.out } } as const

  return (
    <>
      <AnimatePresence {...(onHidden ? { onExitComplete: onHidden } : {})}>
        {shown ? (
          <motion.section
            key="banner"
            aria-labelledby={`${id}-name`}
            className={cx(styles.host, className)}
            data-fixed={fixed ? '' : undefined}
            data-compact={compact ? '' : undefined}
            data-saved={saved ? '' : undefined}
            initial={still ? false : { y: RISE, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { y: RISE, opacity: 0, transition: { duration: EXIT, ease: EASE_IN } }}
            transition={{ duration: ENTER, ease: ease.out }}
          >
            <span id={`${id}-name`} className={styles.srOnly}>Cookie consent</span>
            <AnimatePresence mode="popLayout" initial={false}>
              {saved ? (
                <motion.div key="saved" className={styles.savedTray} role="status" {...fade}>
                  <div className={styles.savedCard}>
                    <span className={styles.tile}><CheckIcon size={14} /></span>
                    <div className={styles.savedText}>
                      <p className={styles.savedTitle}>Choices saved</p>
                      <p className={styles.savedDetail}>{summary(choices, categories)}</p>
                    </div>
                    <Button ref={customize} variant="ghost" size="sm" animated={animated} onClick={() => setPreferring(true)}>Change</Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="ask" className={styles.tray} {...fade}>
                  <div className={styles.copy}>
                    {compact ? <p className={styles.text}>{compactMessage} <a className={styles.link} href={policyHref}>Read the policy</a></p> : <p className={styles.text}>{message}</p>}
                    {failed ? <p className={styles.error} role="alert">{failedMessage}</p> : null}
                  </div>
                  <div className={styles.actions}>
                    <Button ref={customize} className={styles.customize} variant="ghost" size="sm" disabled={busy} animated={animated} onClick={() => setPreferring(true)}>Customize</Button>
                    <Button variant="secondary" shape="pill" size="sm" disabled={busy && pressed !== 'reject'} status={busy && pressed === 'reject' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onClick={() => { setPressed('reject'); void answer(locked) }}>Reject all</Button>
                    <Button variant="secondary" shape="pill" size="sm" disabled={busy && pressed !== 'accept'} status={busy && pressed === 'accept' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onClick={() => { setPressed('accept'); void answer([...locked, ...optional]) }}>Accept all</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        ) : null}
      </AnimatePresence>
      <CookiePreferences open={preferring} onOpenChange={setPreferring} categories={categories} defaultValue={(choices ?? []).filter((key) => optional.includes(key))} onSave={answer} onClosed={() => { if (document.activeElement === document.body) customize.current?.focus({ preventScroll: true }) }} animated={animated} />
    </>
  )
}
