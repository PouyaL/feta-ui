'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type UIEvent } from 'react'
import { ArrowDownIcon } from '@fetaui/react/rounded/arrow-down'
import { ArrowUpIcon } from '@fetaui/react/rounded/arrow-up'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { DownloadIcon } from '@fetaui/react/rounded/download'
import { FilterIcon } from '@fetaui/react/rounded/filter'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { XIcon } from '@fetaui/react/rounded/x'
import { PinIcon } from '@fetaui/react/rounded/pin'
import { SettingsIcon } from '@fetaui/react/rounded/settings'
import { TrashIcon } from '@fetaui/react/rounded/trash'
import { UndoIcon } from '@fetaui/react/rounded/undo'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { DropdownMenu } from '../dropdown-menu/dropdown-menu'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { ease } from '../../motion-tokens'
import { Menu, Shimmer, Tween, useWindow } from '../data-kit/data-kit'
import { SearchField } from '../search/search'
import styles from './data-grid.module.css'

/** The Motion frame: 36 px rows, 160 ms status numbers, 200 ms bulk bar. */
const ROW = 36
const VIEWPORT = 360
const BULK_S = 0.2
/** The lead column of row numbers and checkboxes. */
const LEAD = 40

export type GridValue = string | number
export type GridRow = { id: string; cells: Record<string, GridValue> }
export type GridColumn = {
  key: string
  label: string
  width: number
  /** Right aligned and included in Sum and Avg. */
  numeric?: boolean
  format?: (value: number) => string
  /** Text under the column in the footer row, like Sum. */
  aggregate?: 'sum' | 'avg' | 'count'
  editable?: boolean
  /** Offer this column in the Filter menu. By default, columns with 2 to 8 distinct values are offered. */
  filterable?: boolean
}

export type DataGridProps = {
  title: string
  columns: GridColumn[]
  rows: GridRow[]
  loading?: boolean
  /** Opens with these cells selected, zero based, for a saved view. */
  defaultRange?: { from: { row: number; col: number }; to: { row: number; col: number } }
  defaultSelected?: string[]
  onCellChange?: (rowId: string, key: string, value: GridValue) => void
  onDelete?: (ids: string[]) => void
  /** Shows Copy in the bulk bar. Gets the selected row ids. */
  onCopy?: (ids: string[]) => void
  /** Shows Export. Gets the selected row ids, or every row in the current view. */
  onExport?: (ids: string[]) => void
  animated?: boolean
  className?: string
}

type Cell = { row: number; col: number }
type Edit = { rowId: string; key: string; before: GridValue; after: GridValue }

const letter = (index: number): string => String.fromCharCode(65 + index)
const plain = (value: number): string => Math.round(value).toLocaleString('en-US')

/** A spreadsheet grid for large data. Only rows near the viewport render, so 10,000 rows scroll like ten. */
export function DataGrid({ title, columns: start, rows, loading = false, defaultRange, defaultSelected = [], onCellChange, onDelete, onCopy, onExport, animated = true, className }: DataGridProps) {
  const still = useStill(animated)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [hidden, setHidden] = useState<string[]>([])
  const [pinned, setPinned] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [edits, setEdits] = useState<Record<string, GridValue>>({})
  const [undo, setUndo] = useState<Edit[]>([])
  const [active, setActive] = useState<Cell>(defaultRange?.to ?? { row: 0, col: 0 })
  const [anchor, setAnchor] = useState<Cell>(defaultRange?.from ?? { row: 0, col: 0 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set(defaultSelected))
  const [gone, setGone] = useState<Set<string>>(new Set())
  const scroller = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const editor = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  const columns = useMemo(() => {
    const shown = start.filter((column) => !hidden.includes(column.key))
    return pinned ? [...shown.filter((c) => c.key === pinned), ...shown.filter((c) => c.key !== pinned)] : shown
  }, [start, hidden, pinned])
  const read = useCallback((row: GridRow, key: string): GridValue => edits[`${row.id}:${key}`] ?? row.cells[key] ?? '', [edits])

  const view = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const active = Object.entries(filters).filter(([, values]) => values.length > 0)
    const kept = rows.filter((row) => !gone.has(row.id)
      && active.every(([key, values]) => values.includes(String(read(row, key))))
      && (!needle || start.some((column) => String(read(row, column.key)).toLowerCase().includes(needle))))
    if (!sort) return kept
    return kept.sort((a, b) => {
      const x = read(a, sort.key)
      const y = read(b, sort.key)
      return sort.dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
    })
  }, [rows, gone, query, sort, read, start, filters])

  // Columns the Filter menu offers, each with its distinct values.
  const facets = useMemo(() => start.flatMap((column) => {
    if (column.filterable === false || (column.numeric && column.filterable !== true)) return []
    // By default a column past 8 distinct values is never offered, so stop reading it there and skip its sort.
    const seen = new Set<string>()
    for (const row of rows) {
      const value = String(read(row, column.key))
      if (!value) continue
      seen.add(value)
      if (column.filterable !== true && seen.size > 8) return []
    }
    const offered = column.filterable === true ? seen.size > 0 : seen.size >= 2
    return offered ? [{ column, values: [...seen].sort((a, b) => a.localeCompare(b)) }] : []
  }), [start, rows, read])
  const filterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0)
  const toggleFilter = (key: string, value: string, on: boolean): void => setFilters((was) => {
    const list = was[key] ?? []
    return { ...was, [key]: on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value) }
  })

  const { first, last, total, onScroll: onWindow } = useWindow(view.length, ROW, VIEWPORT)
  const template = useMemo(() => `${LEAD}px ${columns.map((column) => `${column.width}px`).join(' ')}`, [columns])
  const width = LEAD + columns.reduce((sum, column) => sum + column.width, 0)

  const range = { top: Math.min(active.row, anchor.row), bottom: Math.max(active.row, anchor.row), left: Math.min(active.col, anchor.col), right: Math.max(active.col, anchor.col) }
  const stats = useMemo(() => {
    let sum = 0
    let count = 0
    let numeric = 0
    for (let r = range.top; r <= range.bottom; r++) {
      const row = view[r]
      if (!row) continue
      for (let c = range.left; c <= range.right; c++) {
        const column = columns[c]
        if (!column) continue
        count++
        const value = read(row, column.key)
        if (typeof value === 'number') { sum += value; numeric++ }
      }
    }
    return { sum, count, numeric, avg: numeric ? sum / numeric : 0 }
  }, [range.top, range.bottom, range.left, range.right, view, columns, read])
  const footer = useMemo(() => Object.fromEntries(columns.filter((c) => c.aggregate).map((column) => {
    let sum = 0
    let numeric = 0
    for (const row of view) { const value = read(row, column.key); if (typeof value === 'number') { sum += value; numeric++ } }
    const value = column.aggregate === 'avg' ? sum / (numeric || 1) : column.aggregate === 'count' ? view.length : sum
    return [column.key, value]
  })), [columns, view, read])

  const rangeLabel = `${letter(range.left)}${range.top + 1}`
  const cellName = range.top === range.bottom && range.left === range.right ? rangeLabel : `${rangeLabel}:${letter(range.right)}${range.bottom + 1}`
  const spanFormat = columns[range.left]?.format ?? plain

  function reveal(cell: Cell): void {
    const box = scroller.current
    if (!box) return
    const top = cell.row * ROW
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + ROW > box.scrollTop + box.clientHeight - ROW * 2) box.scrollTop = top + ROW * 3 - box.clientHeight
  }
  function moveTo(cell: Cell, extend: boolean): void {
    const next = { row: Math.max(0, Math.min(view.length - 1, cell.row)), col: Math.max(0, Math.min(columns.length - 1, cell.col)) }
    setActive(next)
    if (!extend) setAnchor(next)
    reveal(next)
  }
  function startEdit(seed?: string): void {
    const row = view[active.row]
    const column = columns[active.col]
    if (!row || !column || column.editable === false) return
    setDraft(seed ?? String(read(row, column.key)))
    setEditing(true)
  }
  function commit(): void {
    if (cancelled.current) { cancelled.current = false; return }
    const row = view[active.row]
    const column = columns[active.col]
    setEditing(false)
    scroller.current?.focus()
    if (!row || !column) return
    const before = read(row, column.key)
    const cleaned = draft.replace(/[$,%\s]/g, '')
    const parsed = Number(cleaned)
    // Number('') is 0: an empty cell stays empty, so Sum and Avg skip it.
    const after = !column.numeric ? draft : cleaned === '' ? '' : Number.isFinite(parsed) ? parsed : draft
    if (after === before) return
    setEdits((all) => ({ ...all, [`${row.id}:${column.key}`]: after }))
    setUndo((list) => [...list, { rowId: row.id, key: column.key, before, after }])
    onCellChange?.(row.id, column.key, after)
  }
  function undoLast(): void {
    const last = undo[undo.length - 1]
    if (!last) return
    setEdits((all) => ({ ...all, [`${last.rowId}:${last.key}`]: last.before }))
    setUndo((list) => list.slice(0, -1))
    onCellChange?.(last.rowId, last.key, last.before)
  }
  function reset(): void {
    // Newest first, so the caller ends on the original values. A deleted row stays deleted once the caller has been told.
    for (const edit of [...undo].reverse()) onCellChange?.(edit.rowId, edit.key, edit.before)
    setQuery(''); setSort(null); setHidden([]); setPinned(null); setEdits({}); setUndo([]); setPicked(new Set())
    if (!onDelete) setGone(new Set())
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (editing || e.target !== e.currentTarget) return
    const step = (row: number, col: number): void => { e.preventDefault(); moveTo({ row: active.row + row, col: active.col + col }, e.shiftKey) }
    if (e.key === 'ArrowDown') step(1, 0)
    else if (e.key === 'ArrowUp') step(-1, 0)
    else if (e.key === 'ArrowRight') step(0, 1)
    else if (e.key === 'ArrowLeft') step(0, -1)
    else if (e.key === 'PageDown') step(10, 0)
    else if (e.key === 'PageUp') step(-10, 0)
    else if (e.key === 'Home') { e.preventDefault(); moveTo({ row: e.metaKey || e.ctrlKey ? 0 : active.row, col: 0 }, e.shiftKey) }
    else if (e.key === 'End') { e.preventDefault(); moveTo({ row: e.metaKey || e.ctrlKey ? view.length - 1 : active.row, col: columns.length - 1 }, e.shiftKey) }
    else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit() }
    else if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undoLast() }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); startEdit(e.key) }
  }

  function onScroll(e: UIEvent<HTMLDivElement>): void {
    onWindow(e)
    e.currentTarget.toggleAttribute('data-scrolled', e.currentTarget.scrollLeft > 0)
  }
  const cellAt = (e: PointerEvent<HTMLElement>): Cell | null => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]')
    if (!el) return null
    return { row: Number(el.dataset.row), col: Number(el.dataset.col) }
  }
  useEffect(() => {
    const up = (): void => { dragging.current = false }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])

  function columnMenu(column: GridColumn): ReactNode {
    return (
      <Menu
        label={`${column.label} column`}
        align="end"
        animated={animated}
        items={[
          { id: 'asc', label: 'Sort ascending', icon: <ArrowUpIcon size={14} />, onSelect: () => setSort({ key: column.key, dir: 1 }) },
          { id: 'desc', label: 'Sort descending', icon: <ArrowDownIcon size={14} />, onSelect: () => setSort({ key: column.key, dir: -1 }) },
          { id: 'pin', label: pinned === column.key ? 'Unpin column' : 'Pin column', icon: <PinIcon size={14} />, onSelect: () => setPinned(pinned === column.key ? null : column.key) },
          { id: 'hide', label: 'Hide column', onSelect: () => setHidden((list) => [...list, column.key]) },
          { id: 'filter', label: `Filter by ${column.label}`, icon: <FilterIcon size={14} />, onSelect: () => { const row = view[active.row]; if (row) setFilters((was) => ({ ...was, [column.key]: [String(read(row, column.key))] })) } },
        ]}
        trigger={({ ref, ...props }) => <button {...props} ref={ref as (node: HTMLButtonElement | null) => void} type="button" className={styles.headMenu} aria-label={`${column.label} options`}><MoreHorizontalIcon size={14} aria-hidden="true" /></button>}
      />
    )
  }

  const selectedCount = picked.size
  const rowTop = (index: number): number => index * ROW
  const inRange = (r: number, c: number): boolean => r >= range.top && r <= range.bottom && c >= range.left && c <= range.right
  const edges = (r: number, c: number): string => [r === range.top && 't', r === range.bottom && 'b', c === range.left && 'l', c === range.right && 'r'].filter(Boolean).join(' ')
  const activeId = `grid-cell-${active.row}-${active.col}`
  const allOn = view.length > 0 && selectedCount === view.length
  const swap = { initial: still ? { opacity: 0 } : { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: still ? { opacity: 0 } : { opacity: 0, y: -4 }, transition: { duration: still ? 0 : BULK_S, ease: ease.out } }
  const pinLeft = LEAD

  return (
    <div className={cx(styles.shell, className)} data-still={still ? '' : undefined}>
      <div className={styles.titleBar}>
        <span className={styles.title}>{title}</span>
        <Button variant="ghost" size="sm" leadingIcon={<RefreshCwIcon size={14} />} onClick={reset} animated={animated}>Reset</Button>
      </div>
      <div className={styles.toolbar}>
        <AnimatePresence mode="popLayout" initial={false}>
          {selectedCount ? (
            <motion.div key="bulk" {...swap} className={styles.tools} role="toolbar" aria-label="Bulk actions">
              <IconButton variant="ghost" size="sm" label="Clear selection" icon={<XIcon size={16} />} onClick={() => setPicked(new Set())} animated={animated} />
              <span className={styles.bulkCount}>{selectedCount.toLocaleString('en-US')} selected</span>
              <span className={styles.spacer} />
              {onCopy ? <Button variant="ghost" size="sm" leadingIcon={<CopyIcon size={14} />} onClick={() => onCopy([...picked])} animated={animated}>Copy</Button> : null}
              {onExport ? <Button variant="ghost" size="sm" leadingIcon={<DownloadIcon size={14} />} onClick={() => onExport([...picked])} animated={animated}>Export</Button> : null}
              <Button variant="destructive" shape="pill" size="sm" leadingIcon={<TrashIcon size={14} />} animated={animated} onClick={() => { const ids = [...picked]; onDelete?.(ids); setGone((was) => new Set([...was, ...ids])); setPicked(new Set()) }}>Delete</Button>
            </motion.div>
          ) : (
            <motion.div key="tools" {...swap} className={styles.tools}>
              <SearchField value={query} onValueChange={setQuery} aria-label={`Search ${title}`} animated={animated} className={cx(styles.search)} />
              <span className={styles.rowCount}>{view.length.toLocaleString('en-US')} ROWS</span>
              <span className={styles.spacer} />
              <IconButton variant="ghost" size="sm" label="Undo" icon={<UndoIcon size={16} />} disabled={undo.length === 0} onClick={undoLast} animated={animated} />
              {facets.length ? (
                <DropdownMenu
                  label="Filter"
                  align="end"
                  animated={animated}
                  entries={[
                    ...facets.flatMap(({ column, values }, i) => [
                      ...(i > 0 ? [{ kind: 'separator' as const }] : []),
                      { kind: 'label' as const, label: column.label },
                      ...values.map((value) => ({ kind: 'checkbox' as const, id: `${column.key}:${value}`, label: value, checked: (filters[column.key] ?? []).includes(value), onCheckedChange: (on: boolean) => toggleFilter(column.key, value, on) })),
                    ]),
                    { kind: 'separator' as const },
                    { id: 'clear', label: 'Clear filters', icon: <XIcon size={14} />, disabled: filterCount === 0, onSelect: () => setFilters({}) },
                  ]}
                  trigger={(props) => <Button {...props} variant={filterCount ? 'secondary' : 'ghost'} size="sm" leadingIcon={<FilterIcon size={14} />} className={cx(styles.wideTool)} animated={animated}>{filterCount ? `Filter (${filterCount})` : 'Filter'}</Button>}
                />
              ) : null}
              <DropdownMenu
                label="Columns"
                align="end"
                animated={animated}
                entries={start.map((column) => ({ kind: 'checkbox' as const, label: column.label, checked: !hidden.includes(column.key), onCheckedChange: (on: boolean) => setHidden((list) => (on ? list.filter((key) => key !== column.key) : [...list, column.key])) }))}
                trigger={(props) => <Button {...props} variant="ghost" size="sm" leadingIcon={<SettingsIcon size={14} />} animated={animated}>Columns</Button>}
              />
              {onExport ? <Button variant="ghost" size="sm" leadingIcon={<DownloadIcon size={14} />} className={cx(styles.wideTool)} onClick={() => onExport(view.map((row) => row.id))} animated={animated}>Export</Button> : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        ref={scroller}
        className={styles.scroller}
        role="grid"
        aria-label={title}
        aria-rowcount={view.length + 2}
        aria-colcount={columns.length + 1}
        aria-busy={loading}
        aria-activedescendant={activeId}
        tabIndex={0}
        style={{ '--pin-left': `${pinLeft}px`, height: VIEWPORT } as CSSProperties}
        onKeyDown={onKeyDown}
        onScroll={onScroll}
      >
        <div style={{ width, minWidth: '100%' }}>
          <div className={styles.head} role="row" aria-rowindex={1} style={{ gridTemplateColumns: template }}>
            <span className={styles.corner} role="columnheader" aria-colindex={1}><Checkbox aria-label="Select all rows" checked={allOn} indeterminate={selectedCount > 0 && !allOn} onCheckedChange={(on) => setPicked(on ? new Set(view.map((row) => row.id)) : new Set())} animated={animated} /></span>
            {columns.map((column, c) => (
              <span key={column.key} role="columnheader" aria-colindex={c + 2} aria-sort={sort?.key === column.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined} className={cx(styles.headCell, c === 0 && styles.pinned)} data-numeric={column.numeric ? '' : undefined}>
                <button type="button" className={styles.headLabel} onClick={() => setSort(sort?.key !== column.key ? { key: column.key, dir: 1 } : sort.dir === 1 ? { key: column.key, dir: -1 } : null)}>
                  {column.label}
                  {sort?.key === column.key ? (sort.dir === 1 ? <ArrowUpIcon size={12} aria-hidden="true" /> : <ArrowDownIcon size={12} aria-hidden="true" />) : null}
                </button>
                {columnMenu(column)}
              </span>
            ))}
          </div>

          <div
            className={styles.rows}
            style={{ height: loading ? ROW * 8 : total }}
            onPointerDown={(e) => { if (e.target === editor.current) return; const cell = cellAt(e); if (!cell) return; dragging.current = true; editor.current?.blur(); moveTo(cell, e.shiftKey) }}
            onPointerMove={(e) => { if (!dragging.current) return; const cell = cellAt(e); if (cell && (cell.row !== active.row || cell.col !== active.col)) { setActive(cell) } }}
            onDoubleClick={(e) => { if (e.target !== editor.current) startEdit() }}
          >
            {loading ? Array.from({ length: 8 }, (_, r) => (
              <div key={r} className={styles.row} role="row" style={{ gridTemplateColumns: template, transform: `translateY(${rowTop(r)}px)` }}>
                <span className={styles.number} role="gridcell">{r + 1}</span>
                {columns.map((column, c) => <span key={column.key} role="gridcell" className={cx(styles.cell, c === 0 && styles.pinned)}><Shimmer width="70%" /></span>)}
              </div>
            )) : view.slice(first, last).map((row, i) => {
              const r = first + i
              const on = picked.has(row.id)
              return (
                <div key={row.id} className={styles.row} role="row" aria-rowindex={r + 2} aria-selected={on} data-selected={on ? '' : undefined} style={{ gridTemplateColumns: template, transform: `translateY(${rowTop(r)}px)` }}>
                  <span className={styles.number} role="rowheader" aria-colindex={1}>
                    <span className={styles.numberText}>{r + 1}</span>
                    <span className={styles.numberCheck}><Checkbox aria-label={`Select row ${r + 1}`} checked={on} onCheckedChange={(next) => setPicked((was) => { const set = new Set(was); if (next) set.add(row.id); else set.delete(row.id); return set })} animated={animated} /></span>
                  </span>
                  {columns.map((column, c) => {
                    const value = read(row, column.key)
                    const isActive = r === active.row && c === active.col
                    const shown = inRange(r, c)
                    const text = typeof value === 'number' ? (column.format ?? plain)(value) : value
                    return (
                      <span
                        key={column.key}
                        id={`grid-cell-${r}-${c}`}
                        role="gridcell"
                        aria-colindex={c + 2}
                        aria-selected={shown}
                        data-cell=""
                        data-row={r}
                        data-col={c}
                        data-numeric={column.numeric ? '' : undefined}
                        data-active={isActive ? '' : undefined}
                        data-range={shown ? edges(r, c) || 'in' : undefined}
                        className={cx(styles.cell, c === 0 && styles.pinned)}
                      >
                        {isActive && editing ? (
                          <input
                            ref={editor}
                            className={styles.edit}
                            aria-label={`Edit ${column.label}`}
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') e.currentTarget.blur()
                              if (e.key === 'Escape') { cancelled.current = true; setEditing(false); scroller.current?.focus() }
                            }}
                          />
                        ) : <span className={styles.value}>{text}</span>}
                        {!editing && r === range.bottom && c === range.right ? <span className={styles.handle} aria-hidden="true" /> : null}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div className={styles.foot} role="row" aria-rowindex={view.length + 2} style={{ gridTemplateColumns: template }}>
            <span className={styles.corner} role="gridcell" />
            {columns.map((column, c) => {
              const value = footer[column.key]
              return (
                <span key={column.key} role="gridcell" className={cx(styles.footCell, c === 0 && styles.pinned)} data-numeric={column.numeric ? '' : undefined}>
                  {c === 0 ? `${view.length.toLocaleString('en-US')} rows` : value === undefined ? null : <><span className={styles.footLabel}>{column.aggregate === 'avg' ? 'Avg' : column.aggregate === 'count' ? 'Count' : 'Sum'}</span> {(column.format ?? plain)(value)}</>}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <div className={styles.status} aria-live="polite">
        <span className={styles.statusCell}>{loading ? '·' : editing ? `${letter(active.col)}${active.row + 1}` : cellName}</span>
        <span className={styles.statusStats}>
          {loading ? `LOADING ${rows.length.toLocaleString('en-US')} ROWS` : selectedCount ? `${allOn ? 'ALL ' : ''}${selectedCount.toLocaleString('en-US')} ROWS SELECTED` : editing ? 'ENTER TO SAVE, ESC TO CANCEL' : (
            <>
              {stats.numeric > 1 ? <>SUM <Tween value={stats.sum} format={spanFormat} animated={animated} />{'  '}AVG <Tween value={stats.avg} format={spanFormat} animated={animated} />{'  '}</> : null}
              COUNT <Tween value={stats.count} format={plain} animated={animated} />
            </>
          )}
        </span>
      </div>
    </div>
  )
}
