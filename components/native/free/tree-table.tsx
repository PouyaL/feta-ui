import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Button, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

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
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Flat = { row: TreeRow; level: number }

/** Below this width Owner and Resources hide, as the web's 520 px container rule does. */
const WIDE_AT = 520
const UNFOLD_MS = 240
const allGroups = (rows: TreeRow[]): string[] => rows.flatMap((row) => (row.children ? [row.id, ...allGroups(row.children)] : []))
const anyHas = (rows: TreeRow[], key: 'owner' | 'resources'): boolean => rows.some((row) => row[key] !== undefined || anyHas(row.children ?? [], key))
const dollars = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`

function walk(rows: TreeRow[], open: string[], level: number, out: Flat[]): Flat[] {
  rows.forEach((row) => {
    out.push({ row, level })
    if (row.children && open.includes(row.id)) walk(row.children, open, level + 1, out)
  })
  return out
}

/** The header toggle: one chevron that turns down while any branch is open, as on the web. */
function ToggleAll({ open, renderIcon, still, onPress }: { open: boolean; renderIcon: RenderIcon; still: boolean; onPress: () => void }) {
  const styles = useThemed(makeStyles)
  const turn = useSharedValue(open ? 90 : 0)
  useEffect(() => {
    turn.value = still ? (open ? 90 : 0) : withTiming(open ? 90 : 0, { duration: UNFOLD_MS })
  }, [open, still, turn])
  const motion = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Collapse all' : 'Expand all'} hitSlop={10} onPress={onPress} style={({ pressed }) => [styles.toggleAll, pressed ? styles.pressed : null]}>
      <Animated.View style={motion}>{renderIcon('chevron-right', 14)}</Animated.View>
    </Pressable>
  )
}

/** Rows that roll up. Only open branches render. Selecting rows totals their spend in the footer. */
export function TreeTable({ rows, defaultExpanded, defaultSelected = [], format = dollars, label = 'Spend by team', headers, emptyHint = 'Select rows to total their spend', totalSuffix = ' a month', renderIcon, animated = true, style }: TreeTableProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const first = useMemo(() => defaultExpanded ?? (rows[0] ? [rows[0].id] : []), [defaultExpanded, rows])
  const [open, setOpen] = useState(first)
  const [picked, setPicked] = useState(defaultSelected)
  const [width, setWidth] = useState(0)
  const wide = width >= WIDE_AT
  const showOwner = wide && anyHas(rows, 'owner')
  const showResources = wide && anyHas(rows, 'resources')
  const flat = useMemo(() => walk(rows, open, 0, []), [rows, open])
  // A picked row already rolls up its children, so the walk stops there.
  const sum = (list: TreeRow[]): number => list.reduce((all, row) => all + (picked.includes(row.id) ? row.monthly : sum(row.children ?? [])), 0)
  const total = sum(rows)
  const toggle = (id: string): void => setOpen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))
  const allOn = flat.length > 0 && flat.every(({ row }) => picked.includes(row.id))
  const anyOpen = open.length > 0

  return (
    <View style={[styles.tray, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.card} accessibilityLabel={label}>
        <Table renderIcon={renderIcon} animated={animated} minWidth={wide ? 560 : 0}>
          <TableHeader>
            <TableRow>
              <TableHead type="checkbox"><Checkbox accessibilityLabel="Select all visible rows" checked={allOn} indeterminate={picked.length > 0 && !allOn} onCheckedChange={(on: boolean) => setPicked(on ? flat.map(({ row }) => row.id) : [])} animated={animated} /></TableHead>
              <TableHead>
                <View style={styles.nameHead}>
                  <ToggleAll open={anyOpen} renderIcon={renderIcon} still={still} onPress={() => setOpen(anyOpen ? [] : allGroups(rows))} />
                  <Text style={styles.headText}>{headers?.name ?? 'Name'}</Text>
                </View>
              </TableHead>
              {showOwner ? <TableHead>{headers?.owner ?? 'Owner'}</TableHead> : null}
              {showResources ? <TableHead type="number" width={96}>{headers?.resources ?? 'Resources'}</TableHead> : null}
              <TableHead type="amount" width={88}>{headers?.monthly ?? 'Monthly'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flat.map(({ row, level }) => {
              const on = picked.includes(row.id)
              return (
                <TableRow key={row.id} selected={on}>
                  <TableCell type="checkbox"><Checkbox accessibilityLabel={`Select ${row.name}`} checked={on} onCheckedChange={(next: boolean) => setPicked((list) => (next ? [...list, row.id] : list.filter((id) => id !== row.id)))} animated={animated} /></TableCell>
                  <TableCell type="tree" level={level} {...(row.children ? { expanded: open.includes(row.id), onToggle: () => toggle(row.id) } : {})} {...(row.sub ? { sub: row.sub } : {})}>{row.name}</TableCell>
                  {showOwner ? <TableCell>{row.owner}</TableCell> : null}
                  {showResources ? <TableCell type="number" width={96}>{row.resources}</TableCell> : null}
                  <TableCell type="amount" width={88}>{format(row.monthly)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </View>
      <View style={styles.footer}>
        <Text accessibilityLiveRegion="polite" style={styles.summary}>
          {picked.length ? <><Text style={styles.total}>{picked.length} rows</Text> · <Text style={styles.total}>{format(total)}{totalSuffix}</Text></> : emptyHint}
        </Text>
        <View style={styles.footerActions}>
          {picked.length ? <Button style={SELF.center} variant="ghost" size="sm" leadingIcon={renderIcon('x', 14)} onPress={() => setPicked([])} animated={animated}>Clear</Button> : null}
          <Button style={SELF.center} variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('refresh-cw', 14)} onPress={() => setOpen(first)} animated={animated}>Reset</Button>
        </View>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', gap: space[1], padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  card: { overflow: 'hidden', borderRadius: radius.card, backgroundColor: c.surface },
  nameHead: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  toggleAll: { alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: radius.md },
  pressed: { backgroundColor: c.ink5 },
  headText: { ...type(16, c.textSecondary, '500'), lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], minHeight: 44, paddingVertical: space[1], paddingLeft: space[3.5], paddingRight: space[1.5] },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  summary: { ...type(12, c.textSecondary), flex: 1, lineHeight: 16 },
  total: { fontWeight: '500', color: c.textPrimary },
})
