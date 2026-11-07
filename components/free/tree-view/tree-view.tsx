'use client'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { FileCodeIcon } from '@fetaui/react/rounded/file-code'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { FolderOpenIcon } from '@fetaui/react/rounded/folder-open'
import { ease } from '../../motion-tokens'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './tree-view.module.css'

const UNFOLD_S = 0.24

export type TreeNode = { id: string; name: string; children?: TreeNode[]; /** A short git mark, like M. */ mark?: string }

export type TreeViewProps = {
  label: string
  nodes: TreeNode[]
  /** A small heading on the tray. */
  heading?: string
  defaultExpanded?: string[]
  defaultSelected?: string
  /** F2 renames. Fired on Enter. */
  onRename?: (id: string, name: string) => void
  onSelect?: (id: string, path: string) => void
  /** Shows the plus in the heading. */
  onAdd?: () => void
  animated?: boolean
  className?: string
}

type Flat = { node: TreeNode; level: number; path: string; parent: string | null; position: number; size: number }

function walk(nodes: TreeNode[], open: string[], level: number, base: string, parent: string | null, out: Flat[]): Flat[] {
  nodes.forEach((node, i) => {
    const path = base ? `${base}/${node.name}` : node.name
    out.push({ node, level, path, parent, position: i + 1, size: nodes.length })
    if (node.children && open.includes(node.id)) walk(node.children, open, level + 1, path, node.id, out)
  })
  return out
}
const countAll = (nodes: TreeNode[]): number => nodes.reduce((sum, node) => sum + 1 + countAll(node.children ?? []), 0)
const dot = (name: string): number => { const at = name.lastIndexOf('.'); return at > 0 ? at : name.length }

/** A file tree with guides. Arrow keys move, Right and Left open and close, F2 renames inline. */
export function TreeView({ label, nodes, heading, defaultExpanded, defaultSelected, onRename, onSelect, onAdd, animated = true, className }: TreeViewProps) {
  const still = useStill(animated)
  const [open, setOpen] = useState(defaultExpanded ?? nodes.filter((node) => node.children).map((node) => node.id))
  const [selected, setSelected] = useState(defaultSelected)
  const [active, setActive] = useState(defaultSelected ?? nodes[0]?.id)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const root = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const named = useMemo(() => {
    const apply = (list: TreeNode[]): TreeNode[] => list.map((node) => ({ ...node, name: names[node.id] ?? node.name, ...(node.children ? { children: apply(node.children) } : {}) }))
    return apply(nodes)
  }, [nodes, names])
  const flat = useMemo(() => walk(named, open, 0, '', null, []), [named, open])
  const selectedPath = flat.find((item) => item.node.id === selected)?.path

  useEffect(() => {
    if (!renaming || !input.current) return
    input.current.focus()
    input.current.setSelectionRange(0, dot(input.current.value))
  }, [renaming])

  const focus = (id: string | undefined): void => {
    if (!id) return
    setActive(id)
    root.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus()
  }
  const toggle = (id: string): void => setOpen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))
  function choose(item: Flat): void {
    setSelected(item.node.id)
    setActive(item.node.id)
    onSelect?.(item.node.id, item.path)
    if (item.node.children) toggle(item.node.id)
  }
  function commit(id: string, value: string): void {
    const name = value.trim()
    if (name) { setNames((all) => ({ ...all, [id]: name })); onRename?.(id, name) }
    setRenaming(null)
    requestAnimationFrame(() => focus(id))
  }
  function onKey(e: KeyboardEvent<HTMLUListElement>): void {
    if (renaming) return
    const at = flat.findIndex((item) => item.node.id === active)
    const item = flat[at]
    if (!item) return
    if (e.key === 'ArrowDown') { e.preventDefault(); focus(flat[at + 1]?.node.id) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focus(flat[at - 1]?.node.id) }
    else if (e.key === 'Home') { e.preventDefault(); focus(flat[0]?.node.id) }
    else if (e.key === 'End') { e.preventDefault(); focus(flat[flat.length - 1]?.node.id) }
    else if (e.key === 'ArrowRight' && item.node.children) {
      e.preventDefault()
      if (open.includes(item.node.id)) focus(flat[at + 1]?.node.id)
      else toggle(item.node.id)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (item.node.children && open.includes(item.node.id)) toggle(item.node.id)
      else if (item.parent) focus(item.parent)
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(item) }
    else if (e.key === 'F2') { e.preventDefault(); setRenaming(item.node.id) }
  }

  return (
    <div className={cx(styles.tree, className)} data-still={still ? '' : undefined}>
      {heading ? <div className={styles.headingRow}><p className={styles.heading}>{heading}</p><span className={styles.tools}><IconButton variant="ghost" size="sm" label="New file" icon={<PlusIcon size={16} />} onClick={onAdd} animated={animated} /><IconButton variant="ghost" size="sm" label="Collapse all" icon={<MinusIcon size={16} />} onClick={() => setOpen([])} animated={animated} /></span></div> : null}
      <ul ref={root} role="tree" aria-label={label} className={styles.card} onKeyDown={onKey}>
        {flat.map((item) => {
          const { node, level, position, size } = item
          const folder = Boolean(node.children)
          const icon: ReactNode = folder ? <FolderOpenIcon size={16} aria-hidden="true" /> : <FileCodeIcon size={16} aria-hidden="true" />
          return (
            <li
              key={node.id}
              role="treeitem"
              data-id={node.id}
              aria-level={level + 1}
              aria-posinset={position}
              aria-setsize={size}
              aria-selected={selected === node.id}
              {...(folder ? { 'aria-expanded': open.includes(node.id) } : {})}
              tabIndex={active === node.id ? 0 : -1}
              className={styles.item}
              data-folder={folder ? '' : undefined}
              onClick={() => choose(item)}
              onFocus={() => setActive(node.id)}
            >
              {Array.from({ length: level }, (_, i) => <span key={i} className={styles.guide} aria-hidden="true" />)}
              {folder ? (
                <motion.span className={styles.chevron} initial={false} animate={{ rotate: open.includes(node.id) ? 90 : 0 }} transition={still ? { duration: 0 } : { duration: UNFOLD_S, ease: ease.out }}><ChevronRightIcon size={14} aria-hidden="true" /></motion.span>
              ) : <span className={styles.chevron} aria-hidden="true" />}
              {icon}
              {renaming === node.id ? (
                <input
                  ref={input}
                  aria-label={`Rename ${node.name}`}
                  className={styles.rename}
                  defaultValue={node.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => commit(node.id, e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commit(node.id, e.currentTarget.value)
                    if (e.key === 'Escape') { setRenaming(null); requestAnimationFrame(() => focus(node.id)) }
                  }}
                />
              ) : <span className={styles.name}>{node.name.slice(0, dot(node.name))}<span className={styles.ext}>{node.name.slice(dot(node.name))}</span></span>}
              {node.mark ? <span className={styles.mark} aria-label={`Git status ${node.mark}`}>{node.mark}</span> : null}
            </li>
          )
        })}
      </ul>
      <p className={styles.footer}>{renaming ? 'Enter to save · Esc to cancel' : selectedPath ?? `${countAll(nodes)} items`}</p>
    </div>
  )
}
