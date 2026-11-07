'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { BookmarkCheckIcon } from '@fetaui/react/rounded/bookmark-check'
import { BookmarkIcon } from '@fetaui/react/rounded/bookmark'
import { BookmarkOffIcon } from '@fetaui/react/rounded/bookmark-off'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { delay, duration, ease, spring } from '../../motion-tokens'
import { cx, kit, LabelSwap, pressProps, useStill } from '../motion-kit/motion-kit'
import styles from './save-button.module.css'

export type SaveCollection = { id: string; name: string; meta?: string; tone?: 'accent' | 'success' | 'warning' }

const DEFAULTS: SaveCollection[] = [
  { id: 'reading', name: 'Reading list', meta: '24 items', tone: 'accent' },
  { id: 'ideas', name: 'Ideas', meta: '12 items', tone: 'success' },
  { id: 'later', name: 'For later', meta: '8 items', tone: 'warning' },
]

export type SaveButtonProps = {
  collections?: SaveCollection[]
  defaultSelected?: string[]
  /** Fires with the collection ids this item is in. An empty list means it is no longer saved. */
  onChange?: (selected: string[]) => void
  onNewCollection?: () => void
  disabled?: boolean
  /** `false` turns off the ribbon, the rolling label and the panel scale. */
  animated?: boolean
  className?: string
}

/** A bookmark that files into collections. */
export function SaveButton({ collections = DEFAULTS, defaultSelected = [], onChange, onNewCollection, disabled, animated = true, className }: SaveButtonProps) {
  const still = useStill(animated)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [selected, setSelected] = useState(defaultSelected)
  const [open, setOpen] = useState(false)
  const [removed, setRemoved] = useState(false)
  const saved = selected.length > 0

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(false), delay.reset * 1000)
    return () => clearTimeout(timer)
  }, [removed])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => { if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false) }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  function update(next: string[]): void {
    setSelected(next)
    onChange?.(next)
    setRemoved(next.length === 0)
  }

  function press(): void {
    if (saved && !open) { update([]); return }
    if (!saved && !open) {
      const first = collections[0]
      if (first) update([first.id])
    }
    setOpen(!open)
  }

  const state = removed ? 'removed' : saved ? 'saved' : 'unsaved'
  const Icon = removed ? BookmarkOffIcon : saved ? BookmarkCheckIcon : BookmarkIcon
  const text = removed ? 'Removed' : saved ? 'Saved' : 'Save'

  return (
    <div ref={root} className={cx(styles.root, className)}>
      <motion.button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-pressed={saved}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={cx(kit.control, saved ? kit.inverse : kit.surface, styles.button)}
        onClick={press}
        {...pressProps(still, disabled)}
      >
        <LabelSwap swapKey={state} still={still} className={kit.icon}><Icon /></LabelSwap>
        <span className={styles.label}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={text}
              className={styles.roll}
              initial={still ? { opacity: 0 } : { y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={still ? { opacity: 0 } : { y: -14, opacity: 0 }}
              transition={still ? { duration: 0.12 } : spring.ribbon}
            >
              {text}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={id}
            role="group"
            aria-label="Save to"
            className={cx(kit.tray, styles.panel)}
            initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: ease.out } }}
            transition={{ duration: still ? 0.12 : duration.base, ease: ease.out }}
          >
            <div className={kit.trayHeader}>
              <span>Save to</span>
              <span className={kit.meta}>{collections.length} {collections.length === 1 ? 'collection' : 'collections'}</span>
            </div>
            <div className={cx(kit.card, styles.body)}>
              {collections.map((collection) => {
                const on = selected.includes(collection.id)
                return (
                  <button
                    key={collection.id}
                    type="button"
                    aria-pressed={on}
                    data-on={on ? '' : undefined}
                    className={styles.row}
                    onClick={() => update(on ? selected.filter((item) => item !== collection.id) : [...selected, collection.id])}
                  >
                    <span className={styles.swatch} data-tone={collection.tone ?? 'accent'} aria-hidden="true" />
                    <span className={styles.text}>
                      <span className={styles.name}>{collection.name}</span>
                      {collection.meta ? <span className={kit.meta}>{collection.meta}</span> : null}
                    </span>
                    {on ? <span className={kit.icon}><Tick02Icon /></span> : null}
                  </button>
                )
              })}
              <button type="button" className={cx(styles.row, styles.create)} onClick={onNewCollection}>
                <span className={styles.swatch} data-tone="neutral" aria-hidden="true"><PlusIcon /></span>
                New collection
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
