'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDownIcon } from '@fetaui/react/rounded/arrow-down'
import { FileIcon } from '@fetaui/react/rounded/file'
import { FolderOpenIcon } from '@fetaui/react/rounded/folder-open'
import { Checkbox } from '../checkbox/checkbox'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './tree.module.css'

const ROW_S = 0.24
const ROW_Y = -4
const INDENT = 16
const TYPE_RESET_MS = 600
const STANDARD = [0.25, 0.1, 0.25, 1] as const

export type TreeNode = {
  id: string
  label: string
  icon?: ReactNode
  count?: number | string
  /** A short trailing mark, like a git status. */
  mark?: string
  disabled?: boolean
  children?: TreeNode[]
}

export type TreeItemProps = {
  label: string
  icon?: ReactNode
  count?: number | string | undefined
  mark?: string | undefined
  level?: number
  branch?: boolean
  expanded?: boolean
  selected?: boolean
  disabled?: boolean
  animated?: boolean
  /** Lines down the ancestors' indent. */
  guides?: boolean
  /** Replaces the icon, like a checkbox. */
  lead?: ReactNode
  tabIndex?: number
  className?: string
  onClick?: () => void
  onFocus?: () => void
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  'data-id'?: string
  'aria-checked'?: boolean | 'mixed'
  'aria-level'?: number
}

/** One row: chevron, icon, label and an optional mono count, 16 in per level. */
export function TreeItem({ label, icon, count, mark, level = 0, branch = false, expanded = false, selected = false, disabled = false, animated = true, guides = false, lead, tabIndex = 0, className, onClick, onFocus, onKeyDown, ...rest }: TreeItemProps) {
  const still = useStill(animated)
  return (
    <div
      role="treeitem"
      className={cx(styles.item, className)}
      style={{ paddingInlineStart: 8 + level * INDENT }}
      tabIndex={disabled ? -1 : tabIndex}
      aria-selected={selected}
      aria-expanded={branch ? expanded : undefined}
      aria-disabled={disabled || undefined}
      data-still={still ? '' : undefined}
      onClick={() => { if (!disabled) onClick?.() }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {guides ? Array.from({ length: level }, (_, i) => <span key={i} className={styles.guide} style={{ insetInlineStart: 15 + i * INDENT }} aria-hidden="true" />) : null}
      {lead}
      <span className={styles.chevron}>
        {branch ? <motion.span className={styles.turn} initial={false} animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: still ? 0 : ROW_S, ease: STANDARD }}><ArrowDownIcon /></motion.span> : null}
      </span>
      {lead ? null : <span className={styles.icon}>{icon ?? (branch ? <FolderOpenIcon /> : <FileIcon />)}</span>}
      <span className={styles.label}>{label}</span>
      {count === undefined ? null : <span className={styles.count}>{count}</span>}
      {mark ? <span className={styles.mark} data-mark={mark}>{mark}</span> : null}
    </div>
  )
}

export type TreeProps = {
  nodes: TreeNode[]
  /** The tree's accessible name. */
  label: string
  /** `checkbox` adds a checkbox with parent states. `guides` draws 1 px indent lines. Default `files`. */
  kind?: 'files' | 'navigation' | 'checkbox' | 'guides'
  expanded?: string[]
  defaultExpanded?: string[]
  onExpandedChange?: (ids: string[]) => void
  selected?: string
  defaultSelected?: string
  onSelect?: (id: string) => void
  /** `checkbox`: ids of the checked leaves. */
  checked?: string[]
  defaultChecked?: string[]
  onCheckedChange?: (ids: string[]) => void
  animated?: boolean
  className?: string
}

type Row = { node: TreeNode; level: number; parent: string | null; size: number; position: number }

const leavesOf = (node: TreeNode): string[] => (node.children?.length ? node.children.flatMap(leavesOf) : [node.id])
const openLeavesOf = (node: TreeNode): string[] => (node.disabled ? [] : node.children?.length ? node.children.flatMap(openLeavesOf) : [node.id])

/** A hierarchy of rows. Branches open with a fade, and arrow keys walk it like a file explorer. */
export function Tree({ nodes, label, kind = 'files', expanded, defaultExpanded = [], onExpandedChange, selected, defaultSelected, onSelect, checked, defaultChecked = [], onCheckedChange, animated = true, className }: TreeProps) {
  const still = useStill(animated)
  const root = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const [heldOpen, setHeldOpen] = useState(defaultExpanded)
  const [heldSelected, setHeldSelected] = useState(defaultSelected)
  const [heldChecked, setHeldChecked] = useState(defaultChecked)
  const [focused, setFocused] = useState<string | null>(null)
  const open = expanded ?? heldOpen
  const current = selected ?? heldSelected
  const ticks = checked ?? heldChecked

  const rows = useMemo(() => {
    const walk = (list: TreeNode[], level: number, parent: string | null): Row[] => list.flatMap((node, i) => [
      { node, level, parent, size: list.length, position: i + 1 },
      ...(node.children && open.includes(node.id) ? walk(node.children, level + 1, node.id) : []),
    ])
    return walk(nodes, 0, null)
  }, [nodes, open])

  const usable = rows.filter((row) => !row.node.disabled)
  // Focus or selection can sit in a closed branch, so only a row on screen can hold the tab stop.
  const shown = (id?: string | null): boolean => usable.some((row) => row.node.id === id)
  const stop = shown(focused) ? focused : shown(current) ? current : usable[0]?.node.id

  function setOpen(next: string[]): void {
    setHeldOpen(next)
    onExpandedChange?.(next)
  }

  const toggle = (id: string): void => setOpen(open.includes(id) ? open.filter((item) => item !== id) : [...open, id])

  function choose(row: Row): void {
    if (row.node.children) toggle(row.node.id)
    setHeldSelected(row.node.id)
    onSelect?.(row.node.id)
  }

  function tick(node: TreeNode): void {
    const leaves = openLeavesOf(node)
    const all = leaves.every((id) => ticks.includes(id))
    const next = all ? ticks.filter((id) => !leaves.includes(id)) : [...new Set([...ticks, ...leaves])]
    setHeldChecked(next)
    onCheckedChange?.(next)
  }

  function focusRow(id: string | undefined | null): void {
    if (id) root.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, row: Row): void {
    const at = usable.indexOf(row)
    const { node } = row
    const go = (id: string | undefined | null): void => { e.preventDefault(); focusRow(id) }
    switch (e.key) {
      case 'ArrowDown': go(usable[at + 1]?.node.id); return
      case 'ArrowUp': go(usable[at - 1]?.node.id); return
      case 'Home': go(usable[0]?.node.id); return
      case 'End': go(usable.at(-1)?.node.id); return
      case 'ArrowRight':
        e.preventDefault()
        if (node.children && !open.includes(node.id)) toggle(node.id)
        else if (node.children) focusRow(usable[at + 1]?.node.id)
        return
      case 'ArrowLeft':
        e.preventDefault()
        if (node.children && open.includes(node.id)) toggle(node.id)
        else focusRow(row.parent)
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (kind === 'checkbox') tick(node)
        else choose(row)
        return
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const now = Date.now()
          const text = now - typed.current.at > TYPE_RESET_MS ? e.key : typed.current.text + e.key
          typed.current = { text, at: now }
          focusRow(usable.find((item) => item.node.label.toLowerCase().startsWith(text.toLowerCase()))?.node.id)
        }
    }
  }

  return (
    <div ref={root} role="tree" aria-label={label} aria-multiselectable={kind === 'checkbox' || undefined} className={cx(styles.tree, className)}>
      <AnimatePresence initial={false}>
        {rows.map((row) => {
          const { node } = row
          const leaves = kind === 'checkbox' ? leavesOf(node) : []
          const on = leaves.filter((id) => ticks.includes(id)).length
          const state: boolean | 'indeterminate' = on === 0 ? false : on === leaves.length ? true : 'indeterminate'
          return (
            <motion.div
              key={node.id}
              role="none"
              initial={still ? false : { opacity: 0, y: ROW_Y }}
              animate={{ opacity: 1, y: 0 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, position: 'absolute', transition: { duration: ROW_S / 2 } }}
              transition={{ duration: still ? 0 : ROW_S, ease: STANDARD }}
            >
              <TreeItem
                label={node.label}
                icon={node.icon}
                count={node.count}
                mark={node.mark}
                level={row.level}
                branch={Boolean(node.children)}
                expanded={open.includes(node.id)}
                selected={kind === 'checkbox' ? false : current === node.id}
                disabled={node.disabled ?? false}
                animated={animated}
                guides={kind === 'guides'}
                tabIndex={stop === node.id ? 0 : -1}
                data-id={node.id}
                aria-level={row.level + 1}
                aria-setsize={row.size}
                aria-posinset={row.position}
                {...(kind === 'checkbox' ? {
                  'aria-checked': state === 'indeterminate' ? 'mixed' as const : state,
                  lead: <span className={styles.check} onClick={(e) => { e.stopPropagation(); if (!node.disabled) tick(node) }}><Checkbox tabIndex={-1} aria-label={node.label} disabled={node.disabled ?? false} checked={state === true} indeterminate={state === 'indeterminate'} animated={animated} onCheckedChange={() => undefined} /></span>,
                } : {})}
                onClick={() => (kind === 'checkbox' ? (node.children ? toggle(node.id) : tick(node)) : choose(row))}
                onFocus={() => setFocused(node.id)}
                onKeyDown={(e) => onKeyDown(e, row)}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export type TreeCardProps = { title: string; caption?: string; actions?: ReactNode; children: ReactNode; animated?: boolean; className?: string }

const ENTER_S = 0.4
const ENTER_Y = 8

/** The Soft card trees sit in: a title on a 4% tray, the rows on an inset body. */
export function TreeCard({ title, caption, actions, children, animated = true, className }: TreeCardProps) {
  const still = useStill(animated)
  return (
    <motion.section aria-label={title} className={cx(styles.card, className)} initial={still ? false : { opacity: 0, y: ENTER_Y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: still ? 0 : ENTER_S, ease: STANDARD }}>
      <div className={styles.body}>
        <header className={styles.head}>
          <span className={styles.heading}>
            <span className={styles.title}>{title}</span>
            {caption ? <span className={styles.caption}>{caption}</span> : null}
          </span>
          {actions ? <span className={styles.actions}>{actions}</span> : null}
        </header>
        {children}
      </div>
    </motion.section>
  )
}
