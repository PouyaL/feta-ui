'use client'
import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { FileCodeIcon } from '@fetaui/react/rounded/file-code'
import { PaletteIcon } from '@fetaui/react/rounded/palette'
import { XIcon } from '@fetaui/react/rounded/x'
import { scalePress, spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { DropdownMenu, isCompact } from '../dropdown-menu/dropdown-menu'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './editor-tabs.module.css'

const ENTER_S = 0.4
const ROW_S = 0.24
const ROW_STAGGER_S = 0.04
/** Lines past this one share the last delay, so a long file still lands in under a second. */
const MAX_STAGGER_ROWS = 20
const ENTER_Y = 8
const STANDARD = [0.25, 0.1, 0.25, 1] as const
/** Tabs kept on Mobile before the rest fold into a count. */
const COMPACT_TABS = 2

export type EditorFile = { name: string; code: string; /** Shows the warning dot. */ modified?: boolean; icon?: ReactNode }

export type EditorTabsProps = {
  files: EditorFile[]
  value?: string
  defaultValue?: string
  onValueChange?: (name: string) => void
  /** Without it the close mark is hidden. */
  onClose?: (name: string) => void
  label?: string
  animated?: boolean
  className?: string
}

/** File names can hold spaces, which an id reference cannot. */
const tabId = (uid: string, name: string): string => `${uid}-${encodeURIComponent(name)}`
const fileIcon = (file: EditorFile): ReactNode => file.icon ?? (file.name.endsWith('.css') ? <PaletteIcon /> : <FileCodeIcon />)

function Tab({ file, on, still, uid, showClose, onChoose, onClose, onKeyDown }: { file: EditorFile; on: boolean; still: boolean; uid: string; showClose: boolean; onChoose: () => void; onClose: () => void; onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void }) {
  const text = useLabelMotion(file.name, !still)
  return (
    <div className={styles.tabWrap} data-on={on ? '' : undefined}>
      {on ? <motion.span {...(still ? {} : { layoutId: `${uid}-plate` })} className={styles.plate} style={{ borderRadius: 14 }} transition={spring.slide} /> : null}
      <button
        type="button"
        role="tab"
        id={tabId(uid, file.name)}
        className={styles.tab}
        data-name={file.name}
        aria-selected={on}
        aria-controls={`${uid}-panel`}
        tabIndex={on ? 0 : -1}
        onClick={onChoose}
        onPointerEnter={text.handlers.onPointerEnter}
        onPointerLeave={text.handlers.onPointerLeave}
        onPointerDown={text.handlers.onPointerDown}
        onKeyDown={onKeyDown}
      >
        <span className={styles.icon}>{fileIcon(file)}</span>
        <span className={styles.name}>{text.label}</span>
        {file.modified ? <span className={styles.dot}><span className={styles.srOnly}>Unsaved changes</span></span> : null}
      </button>
      {showClose ? <motion.button type="button" className={styles.close} aria-label={`Close ${file.name}`} tabIndex={on ? 0 : -1} onClick={onClose} {...(still ? {} : { whileTap: { scale: scalePress } })} transition={spring.press}><XIcon /></motion.button> : null}
    </div>
  )
}

/** File tabs for editors. The active tab sits on the surface, and unsaved files carry a warning dot. */
export function EditorTabs({ files, value, defaultValue, onValueChange, onClose, label = 'Open files', animated = true, className }: EditorTabsProps) {
  const still = useStill(animated)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const [held, setHeld] = useState(defaultValue ?? files[0]?.name)
  const [compact, setCompact] = useState(false)
  const current = value ?? held
  const file = files.find((item) => item.name === current) ?? files[0]

  useEffect(() => {
    const node = root.current
    if (!node) return
    const measure = (): void => setCompact(isCompact(node))
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function choose(name: string): void {
    setHeld(name)
    onValueChange?.(name)
  }

  // The open file always keeps a tab: one picked from the fold takes the last slot.
  const kept = files.slice(0, COMPACT_TABS)
  const shown = !compact ? files : !file || kept.includes(file) ? kept : [...kept.slice(0, -1), file]
  const folded = compact ? files.filter((item) => !shown.includes(item)) : []

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    const at = shown.findIndex((item) => item.name === e.currentTarget.dataset.name)
    const next = { ArrowRight: shown[(at + 1) % shown.length], ArrowLeft: shown[(at - 1 + shown.length) % shown.length], Home: shown[0], End: shown.at(-1) }[e.key]
    if (!next) return
    e.preventDefault()
    choose(next.name)
    root.current?.querySelector<HTMLElement>(`[data-name="${CSS.escape(next.name)}"]`)?.focus()
  }

  const lines = file?.code.split('\n') ?? []

  return (
    <motion.div
      ref={root}
      className={cx(styles.editor, className)}
      data-still={still ? '' : undefined}
      initial={still ? false : { opacity: 0, y: ENTER_Y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: still ? 0 : ENTER_S, ease: STANDARD }}
    >
      <div className={styles.bar}>
        <div role="tablist" aria-label={label} className={styles.tabs}>
          {shown.map((item) => <Tab key={item.name} file={item} on={item.name === file?.name} still={still} uid={uid} showClose={Boolean(onClose)} onChoose={() => choose(item.name)} onClose={() => onClose?.(item.name)} onKeyDown={onKeyDown} />)}
        </div>
        {folded.length ? (
          <DropdownMenu
            align="end"
            label={`${folded.length} more files`}
            animated={animated}
            entries={folded.map((item) => ({ label: item.name, onSelect: () => choose(item.name) }))}
            trigger={(props) => <button {...props} type="button" className={styles.more} aria-label={`${folded.length} more files`}>+{folded.length}</button>}
          />
        ) : null}
      </div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={file ? tabId(uid, file.name) : undefined} tabIndex={0} className={styles.body}>
        <pre className={styles.code} key={file?.name}>
          {lines.map((line, i) => (
            <motion.span key={i} className={styles.line} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: still ? 0 : ROW_S, delay: still ? 0 : Math.min(i, MAX_STAGGER_ROWS) * ROW_STAGGER_S, ease: STANDARD }}>
              <span className={styles.lineNumber} aria-hidden="true">{i + 1}</span>
              <code>{line || ' '}</code>
            </motion.span>
          ))}
        </pre>
      </div>
    </motion.div>
  )
}
