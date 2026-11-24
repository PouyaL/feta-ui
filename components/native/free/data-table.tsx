import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
import { panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'
import { IconButton } from './icon-button'
import { Input } from './input'
import { Skeleton } from './skeleton'

const BAR_MS = 200
const SKELETON_ROWS = 4
const barIn = FadeInDown.duration(BAR_MS).easing(Easing.bezierFn(0.23, 1, 0.32, 1)).withInitialValues({ transform: [{ translateY: 4 }] })

export type DataColumn<Row> = {
  key: string
  label: string
  sortable?: boolean
  /** Used for sort, search and filters. */
  value: (row: Row) => string | number
  render?: (row: Row) => ReactNode
  /** Where this column lands in the row's card. */
  card?: 'title' | 'value' | 'status' | 'meta'
}
export type DataFilter = { key: string; label: string; options: string[] }
export type DataAction = { id: string; label: string; icon?: ReactNode; destructive?: boolean; onSelect?: (ids: string[]) => void }
export type DataPrimary = { label: string; icon?: ReactNode; onPress?: () => void }
export type DataSort = { key: string; direction: 'asc' | 'desc' }

export type DataTableProps<Row> = {
  title: string
  /** Default `rows`. */
  noun?: string
  columns: DataColumn<Row>[]
  rows: Row[]
  getId: (row: Row) => string
  filters?: DataFilter[]
  action?: DataPrimary
  actions?: DataAction[]
  /** Rows per page, first is the default. */
  pageSizes?: number[]
  defaultSort?: DataSort
  defaultSelected?: string[]
  defaultQuery?: string
  defaultFilters?: { key: string; value: string }[]
  loading?: boolean
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Sort, search, filter, select and page through rows, each row a card. */
export function DataTable<Row>({ title, noun = 'rows', columns, rows, getId, filters = [], action, actions = [], pageSizes = [10, 25, 50], defaultSort, defaultSelected = [], defaultQuery = '', defaultFilters = [], loading = false, renderIcon, animated = true, style }: DataTableProps<Row>) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [query, setQuery] = useState(defaultQuery)
  const [chips, setChips] = useState(defaultFilters)
  const [sort, setSort] = useState(defaultSort)
  const [picked, setPicked] = useState(defaultSelected)
  const [page, setPage] = useState(0)
  const pageSize = pageSizes[0] ?? 10

  const shown = useMemo(() => {
    const needle = query.toLowerCase()
    const hit = rows.filter((row) => (!needle || columns.some((column) => String(column.value(row)).toLowerCase().includes(needle)))
      && chips.every((chip) => columns.find((column) => column.key === chip.key)?.value(row) === chip.value))
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
  const slot = (kind: NonNullable<DataColumn<Row>['card']>) => columns.find((column) => column.card === kind)
  const titleColumn = slot('title') ?? columns[0]
  const valueColumn = slot('value')
  const statusColumn = slot('status')
  const metaColumn = slot('meta')
  const cell = (column: DataColumn<Row> | undefined, row: Row, textStyle: StyleProp<TextStyle>): ReactNode => {
    if (!column) return null
    return column.render ? column.render(row) : <Text style={textStyle} numberOfLines={1}>{column.value(row)}</Text>
  }

  function toggleChip(key: string, value: string): void {
    setPage(0)
    setChips((list) => (list.some((chip) => chip.key === key && chip.value === value) ? list.filter((chip) => !(chip.key === key && chip.value === value)) : [...list.filter((chip) => chip.key !== key), { key, value }]))
  }

  function nextSort(): void {
    const sortable = columns.filter((column) => column.sortable)
    if (!sortable.length) return
    const index = sortable.findIndex((column) => column.key === sort?.key)
    if (sort?.direction === 'asc' && sort.key) setSort({ key: sort.key, direction: 'desc' })
    else {
      const next = sortable[(index + 1) % sortable.length]
      if (next) setSort({ key: next.key, direction: 'asc' })
    }
  }
  const sortLabel = columns.find((column) => column.key === sort?.key)?.label

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={title} style={[styles.panel, style]}>
      <View style={styles.header}>
        {picked.length ? (
          <Animated.View key="bulk" {...(still ? {} : { entering: barIn })} style={styles.bar}>
            <Text accessibilityLiveRegion="polite" style={styles.title}>{picked.length} selected</Text>
            <View style={styles.actions}>
              {actions.map((item) => <Button key={item.id} variant={item.destructive ? 'destructive' : 'secondary'} size="sm" animated={animated} {...(item.icon ? { leadingIcon: item.icon } : {})} onPress={() => item.onSelect?.(picked)}>{item.label}</Button>)}
              <IconButton variant="ghost" size="sm" label="Clear selection" icon={renderIcon('x', 16)} animated={animated} onPress={() => setPicked([])} />
            </View>
          </Animated.View>
        ) : (
          <View key="title" style={styles.bar}>
            <View style={styles.titles}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              <Text style={styles.count}>{shown.length} of {rows.length} {noun}</Text>
            </View>
            {action ? <Button size="sm" animated={animated} {...(action.icon ? { leadingIcon: action.icon } : {})} {...(action.onPress ? { onPress: action.onPress } : {})}>{action.label}</Button> : null}
          </View>
        )}
        <Input accessibilityLabel="Search" placeholder="Search" value={query} onChangeText={(text: string) => { setQuery(text); setPage(0) }} leading={renderIcon('search', 16)} animated={animated} />
        {filters.length || columns.some((column) => column.sortable) ? (
          <View style={styles.chips}>
            {columns.some((column) => column.sortable) ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Sort${sortLabel ? `, ${sortLabel} ${sort?.direction === 'desc' ? 'descending' : 'ascending'}` : ''}`} hitSlop={8} onPress={nextSort} style={styles.chip}>
                {renderIcon(sort?.direction === 'desc' ? 'arrow-down' : 'arrow-up', 14)}
                <Text style={styles.chipText}>{sortLabel ?? 'Sort'}</Text>
              </Pressable>
            ) : null}
            {filters.flatMap((filter) => filter.options.map((option) => {
              const on = chips.some((chip) => chip.key === filter.key && chip.value === option)
              return (
                <Pressable key={`${filter.key}-${option}`} accessibilityRole="button" accessibilityLabel={`${filter.label}: ${option}`} aria-selected={on} hitSlop={8} onPress={() => toggleChip(filter.key, option)} style={[styles.chip, on ? styles.chipOn : null]}>
                  <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{option}</Text>
                </Pressable>
              )
            }))}
          </View>
        ) : null}
      </View>
      {loading ? (
        <View aria-busy style={styles.loading}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={i} shape="block" height={56} animated={animated} />)}
        </View>
      ) : visible.length === 0 ? <Text style={styles.empty}>No {noun} match</Text> : visible.map((row, i) => {
        const id = getId(row)
        const on = picked.includes(id)
        return (
          <Animated.View key={id} {...(still ? {} : { entering: rowEnter(i) })} style={[styles.row, on ? styles.rowOn : null]}>
            {actions.length ? <Checkbox accessibilityLabel={`Select ${String(titleColumn?.value(row) ?? id)}`} checked={on} onCheckedChange={(next: boolean) => setPicked((list) => (next ? [...list, id] : list.filter((item) => item !== id)))} animated={animated} /> : null}
            <View style={styles.text}>
              <View style={styles.line}>{cell(titleColumn, row, styles.rowTitle)}{cell(valueColumn, row, styles.rowValue)}</View>
              <View style={styles.line}>{cell(metaColumn, row, styles.rowMeta)}{cell(statusColumn, row, styles.rowMeta)}</View>
            </View>
          </Animated.View>
        )
      })}
      {pages > 1 ? (
        <View style={styles.footer}>
          <Text style={styles.count}>Page {at + 1} of {pages}</Text>
          <View style={styles.actions}>
            <IconButton variant="ghost" size="sm" label="Previous page" icon={renderIcon('chevron-left', 16)} disabled={at === 0} animated={animated} onPress={() => setPage(at - 1)} />
            <IconButton variant="ghost" size="sm" label="Next page" icon={renderIcon('chevron-right', 16)} disabled={at === pages - 1} animated={animated} onPress={() => setPage(at + 1)} />
          </View>
        </View>
      ) : null}
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  panel: { width: '100%', overflow: 'hidden', borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  header: { gap: space[3], padding: space[4], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2], minHeight: 36 },
  titles: { flexShrink: 1 },
  title: type(15, c.textPrimary, '500'),
  count: type(12, c.textSecondary),
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space[1], height: 28, paddingHorizontal: space[2.5], borderRadius: radius.full, backgroundColor: c.ink5 },
  chipOn: { backgroundColor: c.inverse },
  chipText: type(12, c.textPrimary),
  chipTextOn: { color: c.textInverse },
  loading: { gap: space[2], padding: space[4] },
  empty: { ...type(13, c.textSecondary), padding: space[6], textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: c.ink5 },
  rowOn: { backgroundColor: c.ink4 },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  rowTitle: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  rowValue: { ...type(14, c.textPrimary), fontVariant: ['tabular-nums'] },
  rowMeta: { ...type(12, c.textSecondary), flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[1], paddingLeft: space[4], paddingRight: space[2] },
})
