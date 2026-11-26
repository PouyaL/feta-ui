import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Button, withInk, SELF } from './button'
import { panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'
import { DropdownMenu, type MenuEntry } from './dropdown-menu'
import { IconButton } from './icon-button'
import { SearchField } from './search'
import { Skeleton } from './skeleton'

const BAR_MS = 200
const SKELETON_ROWS = 3
const EASE = Easing.bezierFn(0.23, 1, 0.32, 1)
const barIn = FadeInDown.duration(BAR_MS).easing(EASE).withInitialValues({ transform: [{ translateY: 4 }] })
const chipIn = ZoomIn.springify().stiffness(420).damping(26).withInitialValues({ transform: [{ scale: 0.9 }] })

export type DataColumn<Row> = {
  key: string
  label: string
  sortable?: boolean
  /** Used for sort, search and filters. */
  value: (row: Row) => string | number
  /** Draws the cell, like a status Badge. */
  render?: (row: Row) => ReactNode
  /** Where this column lands in the row's card: title and value on top, status and meta under them. */
  card?: 'title' | 'value' | 'status' | 'meta'
}
export type DataFilter = { key: string; label: string; options: string[] }
export type DataAction = { id: string; label: string; icon?: ReactNode; destructive?: boolean; onSelect?: (ids: string[]) => void }
/** The one Primary action: a round plus button in the header. */
export type DataPrimary = { label: string; icon?: ReactNode; onPress?: () => void }
export type DataSort = { key: string; direction: 'asc' | 'desc' }
export type FilterChip = { key: string; value: string }

export type DataTableProps<Row> = {
  title: string
  /** Lower case plural for copy, like `projects`. Default `rows`. */
  noun?: string
  columns: DataColumn<Row>[]
  rows: Row[]
  getId: (row: Row) => string
  /** Offered in the view menu; picked ones show as chips under the header. */
  filters?: DataFilter[]
  action?: DataPrimary
  actions?: DataAction[]
  /** Rows per page, first is the default. */
  pageSizes?: number[]
  defaultSort?: DataSort
  defaultSelected?: string[]
  defaultQuery?: string
  defaultFilters?: FilterChip[]
  loading?: boolean
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Sort, search, filter, select and page through rows, in the web's Mobile layout: a header on the tray with search,
 * view options and a round add button, each row a card, and the range with arrows under it.
 */
export function DataTable<Row>({ title, noun = 'rows', columns, rows, getId, filters = [], action, actions = [], pageSizes = [10, 25, 50], defaultSort, defaultSelected = [], defaultQuery = '', defaultFilters = [], loading = false, renderIcon, animated = true, style }: DataTableProps<Row>) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [query, setQuery] = useState(defaultQuery)
  const [searching, setSearching] = useState(false)
  const [chips, setChips] = useState(defaultFilters)
  const [sort, setSort] = useState(defaultSort)
  const [picked, setPicked] = useState(defaultSelected)
  const [page, setPage] = useState(0)
  const pageSize = pageSizes[0] ?? 10
  const icon = (name: string, size: number, color: string = colors.textSecondary): ReactNode => withInk(renderIcon(name, size), color)

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const hit = rows.filter((row) => (!needle || columns.some((column) => String(column.value(row)).toLowerCase().includes(needle)))
      && chips.every((chip) => String(columns.find((column) => column.key === chip.key)?.value(row)) === chip.value))
    const column = columns.find(({ key }) => key === sort?.key)
    if (!column) return hit
    const sign = sort?.direction === 'desc' ? -1 : 1
    return [...hit].sort((a, b) => {
      const left = column.value(a)
      const right = column.value(b)
      return (typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))) * sign
    })
  }, [rows, columns, query, chips, sort])

  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const at = Math.min(page, pages - 1)
  const visible = shown.slice(at * pageSize, (at + 1) * pageSize)
  const part = (kind: NonNullable<DataColumn<Row>['card']>) => columns.filter((column) => column.card === kind)
  const titled = part('title')
  const titleColumns = titled.length ? titled : columns.slice(0, 1)
  const filtered = shown.length !== rows.length
  const sortable = columns.filter((column) => column.sortable)
  const draw = (column: DataColumn<Row>, row: Row): ReactNode => (column.render ? column.render(row) : column.value(row))
  const filterLabel = (key: string): string => filters.find((filter) => filter.key === key)?.label ?? key

  function toggleChip(key: string, value: string, on: boolean): void {
    setPage(0)
    setChips((list) => (on ? [...list.filter((chip) => chip.key !== key), { key, value }] : list.filter((chip) => !(chip.key === key && chip.value === value))))
  }
  const clearFilters = (): void => { setChips([]); setQuery(''); setSearching(false); setPage(0) }

  // The web's Mobile header has no sort headers or Filter button, so sorting and filters live in the view menu.
  const sortEntries: MenuEntry[] = sortable.length ? [
    { kind: 'radio', label: 'Sort by', value: sort?.key ?? '', onValueChange: (key: string) => setSort({ key, direction: sort?.direction ?? 'asc' }), options: sortable.map((column) => ({ value: column.key, label: column.label })) },
    { kind: 'radio', label: 'Order', value: sort?.direction ?? 'asc', onValueChange: (direction: string) => setSort({ key: sort?.key ?? sortable[0]?.key ?? '', direction: direction === 'desc' ? 'desc' : 'asc' }), options: [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }] },
  ] : []
  const filterEntries: MenuEntry[] = filters.flatMap((filter, i): MenuEntry[] => [
    ...(i > 0 || sortEntries.length ? [{ kind: 'separator' as const }] : []),
    { kind: 'label', label: filter.label },
    ...filter.options.map((option): MenuEntry => ({ kind: 'checkbox', id: `${filter.key}:${option}`, label: option, checked: chips.some((chip) => chip.key === filter.key && chip.value === option), onCheckedChange: (on: boolean) => toggleChip(filter.key, option, on) })),
  ])
  const viewEntries = [...sortEntries, ...filterEntries]

  const emptyState = (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{rows.length === 0 ? `No ${noun} yet` : `No ${noun} match`}</Text>
      <Text style={styles.emptyText}>{rows.length === 0 ? `New ${noun} show up here.` : 'Remove a filter or search for something else.'}</Text>
      {rows.length ? <Button style={SELF.center} variant="secondary" size="sm" animated={animated} onPress={clearFilters}>Clear filters</Button> : null}
    </View>
  )

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={title} style={[styles.tray, style]}>
      {picked.length ? (
        <Animated.View key="bulk" {...(still ? {} : { entering: barIn })} role="toolbar" aria-label="Bulk actions" style={[styles.bar, styles.bulk]}>
          <Text accessibilityLiveRegion="polite" style={styles.bulkCount}>{picked.length} selected</Text>
          <Button style={SELF.center} variant="ghost" size="sm" animated={animated} onPress={() => setPicked([])}>Clear</Button>
          <View style={styles.spacer} />
          {actions.map((item) => <IconButton style={SELF.center} key={item.id} variant={item.destructive ? 'destructive' : 'secondary'} size="sm" label={item.label} icon={item.icon ?? icon('more-horizontal', 16, item.destructive ? colors.onSolid : colors.textPrimary)} animated={animated} onPress={() => item.onSelect?.(picked)} />)}
        </Animated.View>
      ) : (
        <View key="bar" style={styles.bar}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
            <Text style={styles.count}>{filtered ? `${shown.length} of ${rows.length}` : rows.length}</Text>
          </View>
          <IconButton style={SELF.center} variant="ghost" size="sm" label={`Search ${noun}`} aria-expanded={searching || Boolean(query)} icon={icon('search', 16, colors.textPrimary)} animated={animated} onPress={() => setSearching(!searching)} />
          {viewEntries.length ? <DropdownMenu label="View options" align="end" animated={animated} entries={viewEntries} trigger={(props) => <IconButton {...props} variant="ghost" size="sm" label="View options" icon={icon('more-horizontal', 16, colors.textPrimary)} animated={animated} />} /> : null}
          {action ? <IconButton style={SELF.center} size="md" label={action.label} icon={action.icon ?? icon('plus', 18, colors.textInverse)} animated={animated} {...(action.onPress ? { onPress: action.onPress } : {})} /> : null}
        </View>
      )}
      {!picked.length && (searching || query) ? (
        <Animated.View {...(still ? {} : { entering: FadeIn.duration(BAR_MS), exiting: FadeOut.duration(BAR_MS) })} style={styles.searchRow}>
          <SearchField accessibilityLabel="Search" placeholder={`Search ${noun}`} value={query} onValueChange={(text) => { setQuery(text); setPage(0) }} renderIcon={renderIcon} animated={animated} />
        </Animated.View>
      ) : null}
      {!picked.length && chips.length ? (
        <View aria-label="Filters" style={styles.toolbar}>
          {chips.map((chip) => (
            <Animated.View key={`${chip.key}:${chip.value}`} {...(still ? {} : { entering: chipIn, exiting: ZoomOut.duration(120) })} style={styles.chip}>
              <Text style={styles.chipText}><Text style={styles.chipKey}>{filterLabel(chip.key)}:</Text> {chip.value}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${filterLabel(chip.key)} filter`} hitSlop={10} onPress={() => toggleChip(chip.key, chip.value, false)} style={styles.chipRemove}>{icon('x', 12)}</Pressable>
            </Animated.View>
          ))}
          <View style={styles.spacer} />
          <Button style={SELF.center} variant="ghost" size="sm" animated={animated} onPress={clearFilters}>Clear all</Button>
        </View>
      ) : null}
      <View style={styles.card}>
        {loading ? (
          <View aria-busy>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => <View key={i} style={[styles.rowCard, i === SKELETON_ROWS - 1 && styles.rowLast]}><Skeleton shape="line" width="60%" animated={animated} /><Skeleton shape="line" width="40%" animated={animated} /></View>)}
          </View>
        ) : visible.length === 0 ? emptyState : visible.map((row, i) => {
          const id = getId(row)
          const on = picked.includes(id)
          const meta = part('meta').map((column) => String(column.value(row))).join(' · ')
          const status = part('status')
          return (
            <Animated.View key={id} {...(still ? {} : { entering: rowEnter(i) })} style={[styles.rowCard, on && styles.rowOn, i === visible.length - 1 && styles.rowLast]}>
              <View style={styles.rowTop}>
                <Checkbox accessibilityLabel={`Select ${String(titleColumns[0]?.value(row) ?? id)}`} checked={on} onCheckedChange={(next: boolean) => setPicked((list) => (next ? [...list, id] : list.filter((item) => item !== id)))} animated={animated} />
                <Text numberOfLines={1} style={styles.rowTitle}>{titleColumns.map((column) => draw(column, row))}</Text>
                {part('value').map((column) => <Text key={column.key} style={styles.rowValue}>{draw(column, row)}</Text>)}
              </View>
              {status.length || meta ? (
                <View style={styles.rowMeta}>
                  {status.map((column) => <View key={column.key}>{column.render ? column.render(row) : <Text style={styles.metaText}>{column.value(row)}</Text>}</View>)}
                  {meta ? <Text numberOfLines={1} style={[styles.metaText, styles.metaFlex]}>{meta}</Text> : null}
                </View>
              ) : null}
            </Animated.View>
          )
        })}
      </View>
      <View style={styles.footer}>
        <Text accessibilityLiveRegion="polite" style={styles.range}>
          {loading ? `Loading ${noun}…` : `${picked.length ? `${picked.length} of ${rows.length} selected · ` : ''}${shown.length ? `${at * pageSize + 1} to ${Math.min((at + 1) * pageSize, shown.length)} of ${shown.length}` : `0 of ${rows.length}`}`}
        </Text>
        <View style={styles.arrows}>
          <IconButton style={SELF.center} variant="secondary" size="md" label="Previous page" icon={icon('chevron-left', 18, at === 0 ? colors.textQuaternary : colors.textPrimary)} disabled={at === 0 || loading} animated={animated} onPress={() => setPage(at - 1)} />
          <IconButton style={SELF.center} variant="secondary" size="md" label="Next page" icon={icon('chevron-right', 18, at === pages - 1 ? colors.textQuaternary : colors.textPrimary)} disabled={at === pages - 1 || loading} animated={animated} onPress={() => setPage(at + 1)} />
        </View>
      </View>
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', maxWidth: 760, gap: space[1], padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48, paddingVertical: space[1], paddingLeft: space[3], paddingRight: space[1] },
  bulk: { paddingRight: space[2], borderRadius: radius.card, backgroundColor: c.surface },
  bulkCount: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  spacer: { flex: 1 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space[1.5], minWidth: 0 },
  title: { ...type(16, c.textPrimary, '500'), lineHeight: 22, flexShrink: 1 },
  count: { ...type(12, c.textSecondary, '400', true), lineHeight: 16 },
  searchRow: { paddingHorizontal: space[1], paddingBottom: space[1] },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1.5], minHeight: 44, paddingVertical: space[1.5], paddingLeft: space[3], paddingRight: space[2], borderRadius: radius.tray, backgroundColor: c.ink4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space[1], height: 28, paddingLeft: space[2.5], paddingRight: space[1], borderRadius: radius.full, backgroundColor: c.ink5 },
  chipText: { ...type(12, c.textPrimary, '500'), lineHeight: 16 },
  chipKey: { color: c.textSecondary, fontWeight: '400' },
  chipRemove: { alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: radius.full },
  card: { overflow: 'hidden', borderRadius: radius.card, backgroundColor: c.surface },
  rowCard: { gap: space[2], paddingVertical: space[3], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: c.ink5 },
  rowLast: { borderBottomWidth: 0 },
  rowOn: { backgroundColor: c.ink4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowTitle: { ...type(16, c.textPrimary, '500'), lineHeight: 22, flex: 1, minWidth: 0 },
  rowValue: { ...type(14, c.textPrimary, '500'), lineHeight: 20, fontVariant: ['tabular-nums'] },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  metaText: { ...type(12, c.textSecondary), lineHeight: 16 },
  metaFlex: { flexShrink: 1 },
  empty: { alignItems: 'center', gap: space[1], paddingVertical: space[10], paddingHorizontal: space[4] },
  emptyTitle: { ...type(16, c.textPrimary, '500'), lineHeight: 22, textAlign: 'center' },
  emptyText: { ...type(14, c.textSecondary), lineHeight: 20, marginBottom: space[2], textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], minHeight: 40, paddingVertical: space[0.5], paddingLeft: space[3.5], paddingRight: space[1.5] },
  range: { ...type(14, c.textSecondary), lineHeight: 18, flexShrink: 1 },
  arrows: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
})
