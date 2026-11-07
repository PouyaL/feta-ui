'use client'
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { XIcon } from '@fetaui/react/rounded/x'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table/table'
import { Tween } from '../data-kit/data-kit'
import styles from './tree-table.module.css'

/** `monthly` is the value the footer totals. `owner` and `resources` are optional; a column hides when no row has it. */
export type TreeRow = { id: string; name: string; sub?: string; owner?: ReactNode; resources?: number; monthly: number; children?: TreeRow[] }

export type TreeTableHeaders = { name?: string; owner?: string; resources?: string; monthly?: string }

export type TreeTableProps = {
  rows: TreeRow[]
  /** Ids open at first. Default: the first row. */
  defaultExpanded?: string[]
  defaultSelected?: string[]
  format?: (value: number) => string
  /** Accessible name of the grid. Default: "Spend by team". */
  label?: string
  /** Column titles. Default: Name, Owner, Resources, Monthly. */
  headers?: TreeTableHeaders
  /** Footer text with nothing selected. Default: "Select rows to total their spend". */
  emptyHint?: string
  /** Text after the footer total. Default: " a month". */
  totalSuffix?: string
  animated?: boolean
  className?: string
}

type Flat = { row: TreeRow; level: number; position: number; siblings: number }

const UNFOLD_S = 0.24
const allGroups = (rows: TreeRow[]): string[] => rows.flatMap((row) => (row.children ? [row.id, ...allGroups(row.children)] : []))
const anyHas = (rows: TreeRow[], key: 'owner' | 'resources'): boolean => rows.some((row) => row[key] !== undefined || anyHas(row.children ?? [], key))
const dollars = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`
function walk(rows: TreeRow[], open: string[], level: number, out: Flat[]): Flat[] {
  rows.forEach((row, i) => {
    out.push({ row, level, position: i + 1, siblings: rows.length })
    if (row.children && open.includes(row.id)) walk(row.children, open, level + 1, out)
  })
  return out
}

/** Rows that roll up. Only open branches render. Selecting rows totals their spend in the footer. */
export function TreeTable({ rows, defaultExpanded, defaultSelected = [], format = dollars, label = 'Spend by team', headers, emptyHint = 'Select rows to total their spend', totalSuffix = ' a month', animated = true, className }: TreeTableProps) {
  const still = useStill(animated)
  const showOwner = anyHas(rows, 'owner')
  const showResources = anyHas(rows, 'resources')
  const first = defaultExpanded ?? (rows[0] ? [rows[0].id] : [])
  const [open, setOpen] = useState(first)
  const [picked, setPicked] = useState(defaultSelected)
  const seen = useRef(new Set<string>())
  const flat = useMemo(() => walk(rows, open, 0, []), [rows, open])
  // A picked row already rolls up its children, so the walk stops there.
  const sum = (list: TreeRow[]): number => list.reduce((all, row) => all + (picked.includes(row.id) ? row.monthly : sum(row.children ?? [])), 0)
  const total = sum(rows)
  const toggle = (id: string): void => setOpen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))

  function onKey(e: KeyboardEvent<HTMLTableSectionElement>): void {
    const row = (e.target as HTMLElement).closest<HTMLElement>('tr')
    if (!row || e.target !== row) return
    const id = row.dataset.rowKey ?? ''
    const item = flat.find((entry) => entry.row.id === id)
    if (e.key === 'ArrowDown') { e.preventDefault(); (row.nextElementSibling as HTMLElement | null)?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (row.previousElementSibling as HTMLElement | null)?.focus() }
    else if (e.key === 'ArrowRight' && item?.row.children && !open.includes(id)) { e.preventDefault(); toggle(id) }
    else if (e.key === 'ArrowLeft' && open.includes(id)) { e.preventDefault(); toggle(id) }
    else if (e.key === ' ') { e.preventDefault(); setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])) }
  }

  const allOn = flat.length > 0 && flat.every(({ row }) => picked.includes(row.id))
  const anyOpen = open.length > 0
  const fresh = new Set(flat.filter(({ row }) => !seen.current.has(row.id)).map(({ row }) => row.id))
  const firstRender = seen.current.size === 0
  for (const { row } of flat) seen.current.add(row.id)

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined}>
      <div className={styles.card}>
        <Table role="treegrid" aria-label={label} animated={animated}>
          <TableHeader>
            <TableRow>
              <TableHead type="checkbox"><Checkbox aria-label="Select all visible rows" checked={allOn} indeterminate={picked.length > 0 && !allOn} onCheckedChange={(on) => setPicked(on ? flat.map(({ row }) => row.id) : [])} animated={animated} /></TableHead>
              <TableHead>
                <span className={styles.nameHead}>
                  <button type="button" className={styles.toggleAll} aria-label={anyOpen ? 'Collapse all' : 'Expand all'} onClick={() => setOpen(anyOpen ? [] : allGroups(rows))}><motion.span className={styles.toggleIcon} initial={false} animate={{ rotate: anyOpen ? 90 : 0 }} transition={still ? { duration: 0 } : { duration: UNFOLD_S }}><ChevronRightIcon size={14} aria-hidden="true" /></motion.span></button>
                  {headers?.name ?? 'Name'}
                </span>
              </TableHead>
              {showOwner ? <TableHead className={styles.wide}>{headers?.owner ?? 'Owner'}</TableHead> : null}
              {showResources ? <TableHead type="number" className={styles.wide}>{headers?.resources ?? 'Resources'}</TableHead> : null}
              <TableHead type="amount">{headers?.monthly ?? 'Monthly'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody onKeyDown={onKey}>
            {flat.map(({ row, level, position, siblings }, index) => {
              const on = picked.includes(row.id)
              const isNew = !firstRender && fresh.has(row.id)
              return (
                <TableRow key={row.id} rowKey={row.id} tabIndex={0} selected={on} aria-level={level + 1} aria-posinset={position} aria-setsize={siblings} {...(row.children ? { 'aria-expanded': open.includes(row.id) } : {})} className={cx(styles.row, isNew && styles.unfold)} style={isNew ? { animationDelay: `${(index % 8) * 30}ms` } : undefined}>
                  <TableCell type="checkbox"><Checkbox aria-label={`Select ${row.name}`} checked={on} onCheckedChange={(next) => setPicked((list) => (next ? [...list, row.id] : list.filter((x) => x !== row.id)))} animated={animated} /></TableCell>
                  <TableCell type="tree" level={level} {...(row.children ? { expanded: open.includes(row.id), onToggle: () => toggle(row.id) } : {})} {...(row.sub ? { sub: row.sub } : {})}>{row.name}</TableCell>
                  {showOwner ? <TableCell className={styles.wide}>{row.owner}</TableCell> : null}
                  {showResources ? <TableCell type="number" className={styles.wide}>{row.resources}</TableCell> : null}
                  <TableCell type="amount">{format(row.monthly)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <footer className={styles.footer}>
        <span aria-live="polite">{picked.length ? <><span className={styles.total}>{picked.length} rows</span> · <Tween className={styles.total} value={total} format={format} animated={animated} />{totalSuffix ? <span className={styles.total}>{totalSuffix}</span> : null}</> : emptyHint}</span>
        <span className={styles.footerActions}>
          {picked.length ? <Button variant="ghost" size="sm" leadingIcon={<XIcon size={14} />} onClick={() => setPicked([])} animated={animated}>Clear</Button> : null}
          <Button variant="secondary" shape="pill" size="sm" leadingIcon={<RefreshCwIcon size={14} />} onClick={() => setOpen(first)} animated={animated}>Reset</Button>
        </span>
      </footer>
    </div>
  )
}
