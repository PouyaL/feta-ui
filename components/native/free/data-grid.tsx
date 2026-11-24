import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type TextInputKeyPressEvent, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { FadeInDown, FadeOutUp, LayoutAnimationConfig } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Button, EASE_OUT, withInk } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { DropdownMenu, type MenuEntry } from './dropdown-menu'
import { IconButton } from './icon-button'
import { SearchField } from './search'
import { Skeleton } from './skeleton'
import { Tween } from './usage-meter'

/** Rows are 44 on touch screens, the smallest target. The web's are 36. */
const ROW = 44
const VIEWPORT = 360
/** Rows rendered past each edge of the viewport. */
const OVERSCAN = 6
const BULK_MS = 200
/** The lead column of row numbers and checkboxes. */
const LEAD = 48
const swapIn = FadeInDown.duration(BULK_MS).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 4 }] })
const swapOut = FadeOutUp.duration(BULK_MS).easing(EASE_OUT)

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
  /** Draws the toolbar, header and checkbox icons by name. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Cell = { row: number; col: number }
type Edit = { rowId: string; key: string; before: GridValue; after: GridValue }

const letter = (index: number): string => String.fromCharCode(65 + index)
const plain = (value: number): string => Math.round(value).toLocaleString('en-US')

/**
 * A spreadsheet grid for large data. Only rows near the viewport render, so 10,000 rows scroll like ten.
 * Tap a cell to select it, tap it again to edit, and long press another cell to stretch the range to it.
 */
export function DataGrid({ title, columns: start, rows, loading = false, defaultRange, defaultSelected = [], onCellChange, onDelete, onCopy, onExport, renderIcon, animated = true, style }: DataGridProps) {
  const s = useThemed(createStyles)
  const c = useColors()
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
  const [offset, setOffset] = useState(0)
  const cancelled = useRef(false)
  const icon = (name: string, size: number, color: string = c.textSecondary): ReactNode => (renderIcon ? withInk(renderIcon(name, size), color) : null)

  const columns = useMemo(() => {
    const shown = start.filter((column) => !hidden.includes(column.key))
    return pinned ? [...shown.filter((col) => col.key === pinned), ...shown.filter((col) => col.key !== pinned)] : shown
  }, [start, hidden, pinned])
  const read = useCallback((row: GridRow, key: string): GridValue => edits[`${row.id}:${key}`] ?? row.cells[key] ?? '', [edits])

  const view = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const on = Object.entries(filters).filter(([, values]) => values.length > 0)
    const kept = rows.filter((row) => !gone.has(row.id)
      && on.every(([key, values]) => values.includes(String(read(row, key))))
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

  const first = Math.max(0, Math.floor(offset / ROW) - OVERSCAN)
  const last = Math.min(view.length, Math.ceil((offset + VIEWPORT) / ROW) + OVERSCAN)
  const width = LEAD + columns.reduce((sum, column) => sum + column.width, 0)

  const range = { top: Math.min(active.row, anchor.row), bottom: Math.max(active.row, anchor.row), left: Math.min(active.col, anchor.col), right: Math.max(active.col, anchor.col) }
  const stats = useMemo(() => {
    let sum = 0
    let count = 0
    let numeric = 0
    for (let r = range.top; r <= range.bottom; r++) {
      const row = view[r]
      if (!row) continue
      for (let col = range.left; col <= range.right; col++) {
        const column = columns[col]
        if (!column) continue
        count++
        const value = read(row, column.key)
        if (typeof value === 'number') { sum += value; numeric++ }
      }
    }
    return { sum, count, numeric, avg: numeric ? sum / numeric : 0 }
  }, [range.top, range.bottom, range.left, range.right, view, columns, read])
  const footer = useMemo(() => Object.fromEntries(columns.filter((col) => col.aggregate).map((column) => {
    let sum = 0
    let numeric = 0
    for (const row of view) { const value = read(row, column.key); if (typeof value === 'number') { sum += value; numeric++ } }
    const value = column.aggregate === 'avg' ? sum / (numeric || 1) : column.aggregate === 'count' ? view.length : sum
    return [column.key, value]
  })), [columns, view, read])

  const rangeLabel = `${letter(range.left)}${range.top + 1}`
  const cellName = range.top === range.bottom && range.left === range.right ? rangeLabel : `${rangeLabel}:${letter(range.right)}${range.bottom + 1}`
  const spanFormat = columns[range.left]?.format ?? plain

  function moveTo(cell: Cell, extend: boolean): void {
    const next = { row: Math.max(0, Math.min(view.length - 1, cell.row)), col: Math.max(0, Math.min(columns.length - 1, cell.col)) }
    setActive(next)
    if (!extend) setAnchor(next)
  }
  function startEdit(): void {
    const row = view[active.row]
    const column = columns[active.col]
    if (!row || !column || column.editable === false) return
    setDraft(String(read(row, column.key)))
    setEditing(true)
  }
  function commit(): void {
    if (cancelled.current) { cancelled.current = false; return }
    const row = view[active.row]
    const column = columns[active.col]
    setEditing(false)
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
  function cancel(): void { cancelled.current = true; setEditing(false) }
  function undoLast(): void {
    const edit = undo[undo.length - 1]
    if (!edit) return
    setEdits((all) => ({ ...all, [`${edit.rowId}:${edit.key}`]: edit.before }))
    setUndo((list) => list.slice(0, -1))
    onCellChange?.(edit.rowId, edit.key, edit.before)
  }
  function reset(): void {
    // Newest first, so the caller ends on the original values. A deleted row stays deleted once the caller has been told.
    for (const edit of [...undo].reverse()) onCellChange?.(edit.rowId, edit.key, edit.before)
    setQuery(''); setSort(null); setHidden([]); setPinned(null); setEdits({}); setUndo([]); setPicked(new Set())
    if (!onDelete) setGone(new Set())
  }
  function tapCell(cell: Cell): void {
    if (editing) commit()
    const single = range.top === range.bottom && range.left === range.right
    if (single && cell.row === active.row && cell.col === active.col) startEdit()
    else moveTo(cell, false)
  }
  function togglePick(id: string): void {
    setPicked((was) => { const next = new Set(was); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function onEditKey(event: TextInputKeyPressEvent): void {
    if (event.nativeEvent.key === 'Escape') cancel()
  }

  function columnEntries(column: GridColumn): MenuEntry[] {
    return [
      { id: 'asc', label: 'Sort ascending', icon: icon('arrow-up', 14), onSelect: () => setSort({ key: column.key, dir: 1 }) },
      { id: 'desc', label: 'Sort descending', icon: icon('arrow-down', 14), onSelect: () => setSort({ key: column.key, dir: -1 }) },
      { id: 'pin', label: pinned === column.key ? 'Unpin column' : 'Pin column', icon: icon('pin', 14), onSelect: () => setPinned(pinned === column.key ? null : column.key) },
      { id: 'hide', label: 'Hide column', onSelect: () => setHidden((list) => [...list, column.key]) },
      { id: 'filter', label: `Filter by ${column.label}`, icon: icon('filter', 14), onSelect: () => { const row = view[active.row]; if (row) setFilters((was) => ({ ...was, [column.key]: [String(read(row, column.key))] })) } },
    ]
  }

  const selectedCount = picked.size
  const allOn = view.length > 0 && selectedCount === view.length
  const inRange = (r: number, col: number): boolean => r >= range.top && r <= range.bottom && col >= range.left && col <= range.right
  const status = loading ? `LOADING ${rows.length.toLocaleString('en-US')} ROWS` : selectedCount ? `${allOn ? 'ALL ' : ''}${selectedCount.toLocaleString('en-US')} ROWS SELECTED` : editing ? 'RETURN TO SAVE, ESC TO CANCEL' : null

  return (
    <View style={[s.shell, style]}>
      <View style={s.titleBar}>
        <Text numberOfLines={1} style={s.title}>{title}</Text>
        <Button variant="ghost" size="sm" leadingIcon={icon('refresh-cw', 14)} onPress={reset} animated={animated}>Reset</Button>
      </View>
      <View style={s.toolbar}>
        <LayoutAnimationConfig skipEntering>
          {selectedCount ? (
            <Animated.View key="bulk" {...(still ? {} : { entering: swapIn, exiting: swapOut })} role="toolbar" aria-label="Bulk actions" style={s.tools}>
              <IconButton variant="ghost" size="sm" label="Clear selection" icon={icon('x', 16)} onPress={() => setPicked(new Set())} animated={animated} />
              <Text style={s.bulkCount}>{selectedCount.toLocaleString('en-US')} selected</Text>
              <View style={s.spacer} />
              {onCopy ? <Button variant="ghost" size="sm" leadingIcon={icon('copy', 14)} onPress={() => onCopy([...picked])} animated={animated}>Copy</Button> : null}
              {onExport ? <Button variant="ghost" size="sm" leadingIcon={icon('download', 14)} onPress={() => onExport([...picked])} animated={animated}>Export</Button> : null}
              <Button variant="destructive" shape="pill" size="sm" leadingIcon={icon('trash', 14, c.textInverse)} animated={animated} onPress={() => { const ids = [...picked]; onDelete?.(ids); setGone((was) => new Set([...was, ...ids])); setPicked(new Set()) }}>Delete</Button>
            </Animated.View>
          ) : (
            <Animated.View key="tools" {...(still ? {} : { entering: swapIn, exiting: swapOut })} style={s.tools}>
              <SearchField style={s.search} value={query} onValueChange={setQuery} accessibilityLabel={`Search ${title}`} animated={animated} {...(renderIcon ? { renderIcon } : {})} />
              <Text style={s.rowCount}>{view.length.toLocaleString('en-US')} ROWS</Text>
              <View style={s.spacer} />
              <IconButton variant="ghost" size="sm" label="Undo" icon={icon('undo', 16)} disabled={undo.length === 0} aria-disabled={undo.length === 0} onPress={undoLast} animated={animated} />
              {facets.length ? (
                <DropdownMenu
                  label="Filter"
                  align="end"
                  animated={animated}
                  entries={[
                    ...facets.flatMap(({ column, values }, i): MenuEntry[] => [
                      ...(i > 0 ? [{ kind: 'separator' as const }] : []),
                      { kind: 'label' as const, label: column.label },
                      ...values.map((value) => ({ kind: 'checkbox' as const, id: `${column.key}:${value}`, label: value, checked: (filters[column.key] ?? []).includes(value), onCheckedChange: (on: boolean) => toggleFilter(column.key, value, on) })),
                    ]),
                    { kind: 'separator' as const },
                    { id: 'clear', label: 'Clear filters', icon: icon('x', 14), disabled: filterCount === 0, onSelect: () => setFilters({}) },
                  ]}
                  trigger={(props) => <Button {...props} variant={filterCount ? 'secondary' : 'ghost'} size="sm" leadingIcon={icon('filter', 14)} animated={animated}>{filterCount ? `Filter (${filterCount})` : 'Filter'}</Button>}
                />
              ) : null}
              <DropdownMenu
                label="Columns"
                align="end"
                animated={animated}
                entries={start.map((column) => ({ kind: 'checkbox' as const, id: `column:${column.key}`, label: column.label, checked: !hidden.includes(column.key), onCheckedChange: (on: boolean) => setHidden((list) => (on ? list.filter((key) => key !== column.key) : [...list, column.key])) }))}
                trigger={(props) => <Button {...props} variant="ghost" size="sm" leadingIcon={icon('settings', 14)} animated={animated}>Columns</Button>}
              />
            </Animated.View>
          )}
        </LayoutAnimationConfig>
      </View>

      <View role="grid" aria-label={title} aria-busy={loading} style={s.frame}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.minWide}>
          <View style={{ width }}>
            <View role="row" style={s.head}>
              <Pressable
                role="checkbox"
                aria-label="Select all rows"
                aria-checked={allOn ? true : selectedCount > 0 ? 'mixed' : false}
                style={[s.corner, s.lead]}
                onPress={() => setPicked(allOn ? new Set() : new Set(view.map((row) => row.id)))}
              >
                <Box on={allOn} mixed={selectedCount > 0 && !allOn} renderIcon={renderIcon} />
              </Pressable>
              {columns.map((column, col) => {
                const sorted = sort?.key === column.key ? sort.dir : 0
                return (
                  <View key={column.key} role="columnheader" style={[s.headCell, col === 0 && pinned ? s.pinnedHead : null, { width: column.width }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${column.label}${sorted === 1 ? ', sorted ascending' : sorted === -1 ? ', sorted descending' : ''}`}
                      style={[s.headLabel, column.numeric && s.headLabelEnd]}
                      onPress={() => setSort(sort?.key !== column.key ? { key: column.key, dir: 1 } : sort.dir === 1 ? { key: column.key, dir: -1 } : null)}
                    >
                      <Text numberOfLines={1} style={s.headText}>{column.label}</Text>
                      {sorted ? icon(sorted === 1 ? 'arrow-up' : 'arrow-down', 12) : null}
                    </Pressable>
                    <DropdownMenu
                      label={`${column.label} column`}
                      align="end"
                      animated={animated}
                      entries={columnEntries(column)}
                      trigger={(props) => (
                        <Pressable {...props} accessibilityRole="button" accessibilityLabel={`${column.label} options`} hitSlop={12} style={s.headMenu}>
                          {icon('more-horizontal', 14, c.textTertiary) ?? <Text style={s.headDots}>···</Text>}
                        </Pressable>
                      )}
                    />
                  </View>
                )
              })}
            </View>

            <ScrollView
              style={s.viewport}
              nestedScrollEnabled
              scrollEventThrottle={16}
              onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => setOffset(event.nativeEvent.contentOffset.y)}
            >
              <View style={[s.rows, { height: (loading ? 8 : view.length) * ROW }]}>
                {loading ? Array.from({ length: 8 }, (_, r) => (
                  <View key={r} role="row" style={[s.row, { top: r * ROW }]}>
                    <View style={[s.lead, s.number]}><Text style={s.numberText}>{r + 1}</Text></View>
                    {columns.map((column) => <View key={column.key} style={[s.cell, { width: column.width }]}><Skeleton width="70%" height={12} animated={animated} /></View>)}
                  </View>
                )) : view.slice(first, last).map((row, i) => {
                  const r = first + i
                  const on = picked.has(row.id)
                  return (
                    <View key={row.id} role="row" aria-selected={on} style={[s.row, { top: r * ROW }]}>
                      <Pressable role="checkbox" aria-label={`Select row ${r + 1}`} aria-checked={on} style={[s.lead, s.number, on && s.picked]} onPress={() => togglePick(row.id)}>
                        {on ? <Box on mixed={false} renderIcon={renderIcon} /> : <Text style={s.numberText}>{r + 1}</Text>}
                      </Pressable>
                      {columns.map((column, col) => {
                        const value = read(row, column.key)
                        const isActive = r === active.row && col === active.col
                        const shown = inRange(r, col)
                        const text = typeof value === 'number' ? (column.format ?? plain)(value) : value
                        return (
                          <Pressable
                            key={column.key}
                            role="cell"
                            aria-label={`${column.label} ${text}`}
                            aria-selected={shown}
                            delayLongPress={300}
                            style={[s.cell, { width: column.width }, column.numeric && s.cellEnd, on && s.picked, shown && s.inRange, isActive && shown && range.top !== range.bottom && s.activeInRange, shown && edgeStyle(s, r === range.top, r === range.bottom, col === range.left, col === range.right)]}
                            onPress={() => tapCell({ row: r, col })}
                            onLongPress={() => moveTo({ row: r, col }, true)}
                          >
                            {isActive && editing ? (
                              <TextInput
                                autoFocus
                                accessibilityLabel={`Edit ${column.label}`}
                                keyboardType={column.numeric ? 'numbers-and-punctuation' : 'default'}
                                returnKeyType="done"
                                selectionColor={c.textPrimary}
                                style={[s.edit, column.numeric && s.editEnd]}
                                value={draft}
                                onBlur={commit}
                                onChangeText={setDraft}
                                onKeyPress={onEditKey}
                                onSubmitEditing={commit}
                              />
                            ) : <Text numberOfLines={1} style={[s.value, column.numeric && s.valueNumeric]}>{text}</Text>}
                            {!editing && r === range.bottom && col === range.right ? <View aria-hidden style={s.handle} /> : null}
                          </Pressable>
                        )
                      })}
                    </View>
                  )
                })}
              </View>
            </ScrollView>

            <View role="row" style={s.foot}>
              <View style={[s.lead, s.corner]} />
              {columns.map((column, col) => {
                const value = footer[column.key]
                return (
                  <View key={column.key} style={[s.footCell, { width: column.width }, column.numeric && s.cellEnd]}>
                    {col === 0
                      ? <Text numberOfLines={1} style={s.footMuted}>{view.length.toLocaleString('en-US')} rows</Text>
                      : value === undefined ? null : <Text numberOfLines={1} style={s.footText}><Text style={s.footMuted}>{column.aggregate === 'avg' ? 'Avg' : column.aggregate === 'count' ? 'Count' : 'Sum'}</Text> {(column.format ?? plain)(value)}</Text>}
                  </View>
                )
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={s.status} aria-live="polite">
        <Text style={s.statusCell}>{loading ? '·' : editing ? `${letter(active.col)}${active.row + 1}` : cellName}</Text>
        {status ? <Text numberOfLines={1} style={s.statusText}>{status}</Text> : (
          // Tween writes its own text natively, so each number is a sibling, not nested text.
          <View style={s.stats}>
            {stats.numeric > 1 ? (
              <>
                <Text style={s.statusText}>SUM </Text><Tween value={stats.sum} format={spanFormat} animated={animated} style={s.statusText} />
                <Text style={s.statusText}>{'  '}AVG </Text><Tween value={stats.avg} format={spanFormat} animated={animated} style={s.statusText} />
                <Text style={s.statusText}>{'  '}</Text>
              </>
            ) : null}
            <Text style={s.statusText}>COUNT </Text><Tween value={stats.count} format={plain} animated={animated} style={s.statusText} />
          </View>
        )}
      </View>
    </View>
  )
}

/** The 1.5 ink ring round the whole range, drawn on its outer cells. */
function edgeStyle(s: ReturnType<typeof createStyles>, top: boolean, bottom: boolean, left: boolean, right: boolean): StyleProp<ViewStyle> {
  return [top && s.edgeTop, bottom && s.edgeBottom, left && s.edgeLeft, right && s.edgeRight]
}

/** The lead column's checkbox: ink when on, a bar when some rows are on. */
function Box({ on, mixed, renderIcon }: { on: boolean; mixed: boolean; renderIcon: RenderIcon | undefined }) {
  const s = useThemed(createStyles)
  const c = useColors()
  return (
    <View style={[s.box, (on || mixed) && s.boxOn]}>
      {on ? (renderIcon ? withInk(renderIcon('check', 12), c.textInverse) : null) : mixed ? <View style={s.mixed} /> : null}
    </View>
  )
}

const createStyles = (c: Colors) => {
  const mono = (size: number, lineHeight: number): TextStyle => ({ fontFamily: font.mono, fontSize: size, lineHeight })
  const line = { borderBottomColor: c.ink8, borderBottomWidth: 1, borderRightColor: c.ink8, borderRightWidth: 1 }
  return StyleSheet.create({
    shell: { backgroundColor: c.ink4, borderRadius: radius.tray, gap: space[1], padding: space[1], width: '100%' },
    titleBar: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingLeft: space[3], paddingRight: space[1], paddingTop: space[1] },
    title: { ...type(16, c.textPrimary, '600'), flexShrink: 1, lineHeight: 22 },
    toolbar: { minHeight: 48 },
    tools: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[1], minHeight: 44, paddingHorizontal: space[2], paddingVertical: space[1] },
    search: { flexBasis: '100%', flexGrow: 1 },
    rowCount: { ...mono(11, 16), color: c.textSecondary, letterSpacing: 0.44 },
    bulkCount: { ...type(14, c.textPrimary, '500'), lineHeight: 20, paddingHorizontal: space[2] },
    spacer: { flex: 1 },
    frame: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
    minWide: { flexGrow: 1 },
    head: { flexDirection: 'row', height: ROW },
    lead: { alignItems: 'center', justifyContent: 'center', width: LEAD, ...line },
    corner: { backgroundColor: c.subtle },
    headCell: { alignItems: 'center', backgroundColor: c.ink4, flexDirection: 'row', gap: space[1.5], justifyContent: 'space-between', paddingLeft: space[3], paddingRight: space[1], ...line },
    pinnedHead: { backgroundColor: c.subtle },
    headLabel: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[1], minHeight: 44 },
    headLabelEnd: { marginLeft: 'auto' },
    headText: { ...type(12, c.textSecondary, '500'), lineHeight: 16 },
    headMenu: { alignItems: 'center', borderRadius: radius.sm, height: 20, justifyContent: 'center', width: 20 },
    headDots: { ...type(12, c.textTertiary, '600'), lineHeight: 16 },
    viewport: { height: VIEWPORT },
    rows: { position: 'relative' },
    row: { flexDirection: 'row', height: ROW, left: 0, position: 'absolute' },
    number: { backgroundColor: c.surface },
    numberText: { ...mono(13, 18), color: c.textPrimary },
    picked: { backgroundColor: c.ink4 },
    cell: { alignItems: 'center', backgroundColor: c.surface, flexDirection: 'row', paddingHorizontal: space[3], ...line },
    cellEnd: { justifyContent: 'flex-end' },
    inRange: { backgroundColor: c.ink4 },
    activeInRange: { backgroundColor: c.surface },
    edgeTop: { borderTopColor: c.textPrimary, borderTopWidth: 1.5 },
    edgeBottom: { borderBottomColor: c.textPrimary, borderBottomWidth: 1.5 },
    edgeLeft: { borderLeftColor: c.textPrimary, borderLeftWidth: 1.5 },
    edgeRight: { borderRightColor: c.textPrimary, borderRightWidth: 1.5 },
    value: { ...type(13, c.textPrimary), lineHeight: 18 },
    valueNumeric: { ...mono(13, 18), color: c.textPrimary },
    handle: { backgroundColor: c.textPrimary, borderColor: c.surface, borderRadius: radius.sm, borderWidth: 1, bottom: -4, height: 6, position: 'absolute', right: -4, width: 6, zIndex: 2 },
    edit: { ...StyleSheet.absoluteFill, ...type(13, c.textPrimary), backgroundColor: c.surface, borderColor: c.textPrimary, borderWidth: 2, paddingHorizontal: space[3] },
    editEnd: { textAlign: 'right' },
    foot: { borderTopColor: c.ink8, borderTopWidth: 1, flexDirection: 'row', height: ROW },
    footCell: { alignItems: 'center', backgroundColor: c.subtle, flexDirection: 'row', paddingHorizontal: space[3], ...line },
    footText: { ...type(12, c.textPrimary, '500'), lineHeight: 16 },
    footMuted: { ...type(12, c.textTertiary), lineHeight: 16 },
    box: { alignItems: 'center', borderColor: c.ink10, borderRadius: radius.sm, borderWidth: 1, height: 18, justifyContent: 'center', width: 18 },
    boxOn: { backgroundColor: c.inverse, borderColor: c.inverse },
    mixed: { backgroundColor: c.textInverse, borderRadius: radius.xs, height: 2, width: 8 },
    status: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between', minHeight: 32, paddingHorizontal: space[3] },
    statusCell: { ...mono(11, 16), color: c.textPrimary, letterSpacing: 0.44 },
    stats: { alignItems: 'center', flexDirection: 'row', flexShrink: 1 },
    statusText: { ...mono(11, 16), color: c.textSecondary, flexShrink: 1, letterSpacing: 0.44 },
  })
}
