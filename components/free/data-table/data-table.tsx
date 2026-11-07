'use client'
import { motion, AnimatePresence } from 'motion/react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDownIcon } from '@fetaui/react/rounded/arrow-down'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { SearchIcon } from '@fetaui/react/rounded/search'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { XIcon } from '@fetaui/react/rounded/x'
import { Button } from '../button/button'
import { DropdownMenu } from '../dropdown-menu/dropdown-menu'
import { Checkbox } from '../checkbox/checkbox'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Pagination } from '../pagination/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, useRowReorder, type SortDirection, type TableCellType } from '../table/table'
import { ease, spring } from '../../motion-tokens'
import { Shimmer, Tween } from '../data-kit/data-kit'
import { SearchField } from '../search/search'
import styles from './data-table.module.css'

/** The Table Motion frame: rows reorder over 300 ms and the bar crossfades over 200 ms. */
const REORDER_MS = 300
const BAR_MS = 0.2

export type DataColumn<Row> = {
  key: string
  label: string
  type?: TableCellType
  width?: number
  sortable?: boolean
  /** Used for sort, search and filters. */
  value: (row: Row) => string | number
  render?: (row: Row) => ReactNode
  /** Where this column lands in a Mobile card. */
  card?: 'title' | 'value' | 'status' | 'meta'
}

export type DataFilter = { key: string; label: string; options: string[] }
export type DataAction = { id: string; label: string; icon?: ReactNode; destructive?: boolean; onSelect?: (ids: string[]) => void }
/** The one Primary action. Under 520 px it becomes a round icon button. */
export type DataPrimary = { label: string; icon?: ReactNode; onClick?: () => void }

const bar = (still: boolean) => ({
  initial: still ? { opacity: 0 } : { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: still ? { opacity: 0 } : { opacity: 0, y: -4 },
  transition: { duration: still ? 0 : BAR_MS, ease: ease.out },
})

export type DataTableHeaderProps = {
  title: string
  count: number
  total: number
  query: string
  onQueryChange: (query: string) => void
  searchLabel?: string
  filterCount?: number
  onFilter?: () => void
  /** Icon button that opens the view menu. */
  view?: ReactNode
  /** The Primary action, like New project. */
  action?: DataPrimary | undefined
  /** Row ids in the selection. Any at all turns the bar into bulk actions. */
  selected?: string[]
  onClear?: () => void
  actions?: DataAction[]
  /** Chips under the bar, usually Table Toolbar. */
  children?: ReactNode
  animated?: boolean
}

/** Sits on the tray above the card. Selecting rows turns it into an inset card of bulk actions. */
export function DataTableHeader({ title, count, total, query, onQueryChange, searchLabel = 'Search', filterCount = 0, onFilter, view, action, selected = [], onClear, actions = [], children, animated = true }: DataTableHeaderProps) {
  const still = useStill(animated)
  const [searching, setSearching] = useState(false)
  const filtered = count !== total
  const plus = action?.icon ?? <PlusIcon size={16} />
  return (
    <div className={styles.header}>
      <AnimatePresence mode="popLayout" initial={false}>
        {selected.length > 0 ? (
          <motion.div key="bulk" {...bar(still)} className={styles.bulk} role="toolbar" aria-label="Bulk actions">
            <span className={styles.bulkCount}><Tween value={selected.length} format={(v) => String(Math.round(v))} animated={animated} /> selected</span>
            <Button variant="ghost" size="sm" onClick={onClear} animated={animated}>Clear</Button>
            <span className={styles.spacer} />
            {actions.map((item) => {
              const variant = item.destructive ? 'destructive' : 'secondary'
              return (
                <span key={item.id} className={styles.bulkAction}>
                  <Button className={cx(styles.wide)} variant={variant} shape="pill" size="sm" leadingIcon={item.icon} animated={animated} onClick={() => item.onSelect?.(selected)}>{item.label}</Button>
                  <IconButton className={cx(styles.narrow)} variant={variant} size="sm" label={item.label} icon={item.icon ?? <MoreHorizontalIcon size={16} />} animated={animated} onClick={() => item.onSelect?.(selected)} />
                </span>
              )
            })}
          </motion.div>
        ) : (
          <motion.div key="bar" {...bar(still)} className={styles.bar}>
            <span className={styles.title}>{title}<span className={styles.count}>{filtered ? `${count} of ${total}` : total}</span></span>
            <span className={cx(styles.searchSlot)} data-open={searching || query ? '' : undefined}><SearchField value={query} onValueChange={onQueryChange} placeholder={searchLabel} aria-label={searchLabel} animated={animated} className={cx(styles.search)} /></span>
            <IconButton className={cx(styles.narrow)} variant="ghost" size="sm" label={searchLabel} aria-expanded={searching} icon={<SearchIcon size={16} />} onClick={() => setSearching(!searching)} animated={animated} />
            {onFilter ? <Button className={cx(styles.wide)} variant="secondary" shape="pill" size="sm" trailingIcon={<ArrowDownIcon size={14} />} onClick={onFilter} animated={animated}>{filterCount ? `Filters · ${filterCount}` : 'Filter'}</Button> : null}
            {view}
            {action ? (
              <>
                <Button className={cx(styles.wide)} shape="pill" size="sm" leadingIcon={plus} onClick={action.onClick} animated={animated}>{action.label}</Button>
                <IconButton className={cx(styles.narrow)} size="sm" label={action.label} icon={plus} onClick={action.onClick} animated={animated} />
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
      {selected.length === 0 ? children : null}
    </div>
  )
}

export type FilterChip = { key: string; label: string; value: string }

export type TableToolbarProps = {
  chips: FilterChip[]
  /** The fields Add filter offers. */
  fields: DataFilter[]
  onAdd: (key: string, value: string) => void
  onRemove: (key: string) => void
  onClear: () => void
  animated?: boolean
}

/** Filter chips with Add filter and Clear all. Filters apply at once. */
export function TableToolbar({ chips, fields, onAdd, onRemove, onClear, animated = true }: TableToolbarProps) {
  const still = useStill(animated)
  return (
    <div className={styles.toolbar} role="group" aria-label="Filters">
      {chips.length === 0 ? <span className={styles.none}>No filters</span> : null}
      <AnimatePresence initial={false}>
        {chips.map((chip) => (
          <motion.span key={chip.key} className={styles.chip} initial={still ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.9 }} transition={still ? { duration: 0 } : spring.pop}>
            <span className={styles.chipKey}>{chip.label}:</span> {chip.value}
            <button type="button" className={styles.chipRemove} aria-label={`Remove ${chip.label} filter`} onClick={() => onRemove(chip.key)}><XIcon size={12} aria-hidden="true" /></button>
          </motion.span>
        ))}
      </AnimatePresence>
      <span className={styles.addSlot} />
      <DropdownMenu
        label="Add filter"
        animated={animated}
        entries={fields.map((field) => ({ label: field.label, items: field.options.map((option) => ({ label: option, onSelect: () => onAdd(field.key, option) })) }))}
        trigger={(props) => <Button {...props} variant="secondary" shape="pill" size="sm" leadingIcon={<PlusIcon size={14} />} animated={animated}>Add filter</Button>}
      />
      {chips.length ? <Button variant="ghost" size="sm" onClick={onClear} animated={animated}>Clear all</Button> : null}
    </div>
  )
}

export type DataTableProps<Row> = {
  title: string
  /** Lower case plural for copy, like `projects`. */
  noun?: string
  columns: DataColumn<Row>[]
  rows: Row[]
  getId: (row: Row) => string
  filters?: DataFilter[]
  action?: DataPrimary
  actions?: DataAction[]
  pageSizes?: number[]
  defaultSort?: { key: string; direction: SortDirection }
  defaultSelected?: string[]
  defaultQuery?: string
  defaultFilters?: FilterChip[]
  /** Skeleton rows keep the frame. */
  loading?: boolean
  animated?: boolean
  className?: string
}

/** Sort, search, filters, paging and bulk actions in one frame. Only the current page renders, so long lists stay fast. */
export function DataTable<Row>({ title, noun = 'rows', columns, rows, getId, filters = [], action, actions = [], pageSizes = [10, 25, 50], defaultSort, defaultSelected = [], defaultQuery = '', defaultFilters = [], loading = false, animated = true, className }: DataTableProps<Row>) {
  const still = useStill(animated)
  const [query, setQuery] = useState(defaultQuery)
  const [chips, setChips] = useState(defaultFilters)
  const [sort, setSort] = useState(defaultSort ?? null)
  const [picked, setPicked] = useState(defaultSelected)
  const [hidden, setHidden] = useState<string[]>([])
  const [perPage, setPerPage] = useState(pageSizes[0] ?? 10)
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const body = useRef<HTMLTableSectionElement>(null)

  const visibleColumns = columns.filter((column) => !hidden.includes(column.key))
  const needle = query.trim().toLowerCase()
  const matching = useMemo(() => rows.filter((row) => {
    const hit = !needle || columns.some((column) => String(column.value(row)).toLowerCase().includes(needle))
    return hit && chips.every((chip) => {
      const column = columns.find((item) => item.key === chip.key)
      return column ? String(column.value(row)) === chip.value : true
    })
  }), [rows, columns, needle, chips])
  const ordered = useMemo(() => {
    const column = sort && columns.find((item) => item.key === sort.key)
    if (!column || !sort) return matching
    const sign = sort.direction === 'asc' ? 1 : -1
    return [...matching].sort((a, b) => {
      const x = column.value(a)
      const y = column.value(b)
      return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
    })
  }, [matching, sort, columns])

  const pages = Math.max(1, Math.ceil(ordered.length / perPage))
  const current = Math.min(page, pages - 1)
  const shown = ordered.slice(current * perPage, (current + 1) * perPage)
  const shownIds = shown.map(getId)
  useRowReorder(body, shownIds.join(), still, REORDER_MS)

  const allOn = shownIds.length > 0 && shownIds.every((id) => picked.includes(id))
  const someOn = shownIds.some((id) => picked.includes(id))
  const toggle = (id: string, on: boolean): void => setPicked((list) => (on ? [...list, id] : list.filter((item) => item !== id)))
  const togglePage = (on: boolean): void => setPicked((list) => (on ? [...new Set([...list, ...shownIds])] : list.filter((id) => !shownIds.includes(id))))
  function cycleSort(key: string): void {
    setSort((was) => (was?.key !== key ? { key, direction: 'asc' } : was.direction === 'asc' ? { key, direction: 'desc' } : null))
  }
  const clearFilters = (): void => { setChips([]); setQuery(''); setShowFilters(false) }
  const cell = (column: DataColumn<Row>, row: Row): ReactNode => column.render ? column.render(row) : column.value(row)
  const cardPart = (part: NonNullable<DataColumn<Row>['card']>) => columns.filter((column) => column.card === part)

  const view = (
    <DropdownMenu
      label="Columns"
      align="end"
      animated={animated}
      entries={columns.map((column) => ({ kind: 'checkbox' as const, label: column.label, checked: !hidden.includes(column.key), onCheckedChange: (on: boolean) => setHidden((list) => (on ? list.filter((key) => key !== column.key) : [...list, column.key])) }))}
      trigger={(props) => <IconButton {...props} variant="ghost" size="sm" label="View options" icon={<MoreHorizontalIcon size={16} />} animated={animated} />}
    />
  )
  const empty = !loading && shown.length === 0
  const emptyState = rows.length === 0 ? (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>No {noun} yet</p>
      <p className={styles.emptyText}>New {noun} show up here.</p>
    </div>
  ) : (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>No {noun} match these filters</p>
      <p className={styles.emptyText}>Remove a filter or search for something else.</p>
      <Button variant="secondary" size="sm" onClick={clearFilters} animated={animated}>Clear filters</Button>
    </div>
  )

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined}>
      <DataTableHeader title={title} count={ordered.length} total={rows.length} query={query} onQueryChange={(next) => { setQuery(next); setPage(0) }} searchLabel={`Search ${noun}`} filterCount={chips.length} {...(filters.length ? { onFilter: () => setShowFilters((on) => !on) } : {})} view={view} {...(action ? { action } : {})} selected={picked} onClear={() => setPicked([])} actions={actions} animated={animated}>
        {showFilters || chips.length ? <TableToolbar chips={chips} fields={filters} animated={animated} onAdd={(key, value) => { setChips((list) => [...list.filter((chip) => chip.key !== key), { key, value, label: filters.find((item) => item.key === key)?.label ?? key }]); setPage(0) }} onRemove={(key) => setChips((list) => list.filter((chip) => chip.key !== key))} onClear={clearFilters} /> : null}
      </DataTableHeader>

      <div className={styles.card}>
        <div className={styles.tableWide}>
          {empty ? emptyState : (
            <Table animated={animated} aria-busy={loading} aria-label={title}>
              <TableHeader>
                <TableRow>
                  <TableHead type="checkbox"><Checkbox aria-label="Select this page" checked={allOn} indeterminate={someOn && !allOn} onCheckedChange={togglePage} animated={animated} /></TableHead>
                  {visibleColumns.map((column) => <TableHead key={column.key} type={column.type ?? 'text'} {...(column.width ? { width: column.width } : {})} {...(column.sortable ? { sort: sort?.key === column.key ? sort.direction : false, onSort: () => cycleSort(column.key) } : {})}>{column.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody ref={body}>
                {loading
                  ? Array.from({ length: 5 }, (_, i) => <TableRow key={i}><TableCell type="checkbox"><Shimmer width={18} height={18} /></TableCell>{visibleColumns.map((column) => <TableCell key={column.key} className={styles.tall}><Shimmer width="70%" /></TableCell>)}</TableRow>)
                  : shown.map((row) => {
                    const id = getId(row)
                    const on = picked.includes(id)
                    return (
                      <TableRow key={id} rowKey={id} selected={on}>
                        <TableCell type="checkbox" className={styles.tall}><Checkbox aria-label={`Select ${String(columns[0]?.value(row))}`} checked={on} onCheckedChange={(next) => toggle(id, next)} animated={animated} /></TableCell>
                        {visibleColumns.map((column) => <TableCell key={column.key} type={column.type ?? 'text'} className={styles.tall} sorted={sort?.key === column.key}>{cell(column, row)}</TableCell>)}
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </div>
        <div className={styles.cards}>
          {empty ? emptyState : loading ? Array.from({ length: 3 }, (_, i) => <div key={i} className={styles.rowCard}><Shimmer width="60%" /><Shimmer width="40%" /></div>) : shown.map((row) => {
            const id = getId(row)
            const on = picked.includes(id)
            return (
              <div key={id} className={styles.rowCard} data-selected={on ? '' : undefined}>
                <div className={styles.rowCardTop}>
                  <Checkbox aria-label={`Select ${String(columns[0]?.value(row))}`} checked={on} onCheckedChange={(next) => toggle(id, next)} animated={animated} />
                  <span className={styles.rowCardTitle}>{cardPart('title').map((column) => <span key={column.key}>{cell(column, row)}</span>)}</span>
                  {cardPart('value').map((column) => <span key={column.key} className={styles.rowCardValue}>{cell(column, row)}</span>)}
                </div>
                <div className={styles.rowCardMeta}>
                  {cardPart('status').map((column) => <span key={column.key}>{cell(column, row)}</span>)}
                  <span>{cardPart('meta').map((column) => String(column.value(row))).join(' · ')}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <footer className={styles.footer}>
        {picked.length ? <span className={styles.note} style={{ marginRight: 'var(--feta-space-3)' }}><Tween value={picked.length} format={(v) => String(Math.round(v))} animated={animated} /> of {rows.length} selected</span> : null}
        {loading ? <span className={styles.note}>Loading {noun}…</span>
          : <Pagination kind="table" pages={pages} page={current + 1} onPageChange={(next) => setPage(next - 1)} perPage={perPage} perPageOptions={pageSizes} onPerPageChange={(next) => { setPerPage(next); setPage(0) }} total={ordered.length} aria-label={`${title} pages`} animated={animated} />}
      </footer>
    </div>
  )
}
