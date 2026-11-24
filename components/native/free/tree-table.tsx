import { useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useThemed } from './card'
import { Checkbox } from './checkbox'
import { IconButton } from './icon-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

export type TreeRow = { id: string; name: string; sub?: string; owner: ReactNode; resources: number; monthly: number; children?: TreeRow[] }

export type TreeTableProps = {
  rows: TreeRow[]
  /** Ids open at first. Default: the first row. */
  defaultExpanded?: string[]
  defaultSelected?: string[]
  format?: (value: number) => string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Flat = { row: TreeRow; level: number }

const allGroups = (rows: TreeRow[]): string[] => rows.flatMap((row) => (row.children ? [row.id, ...allGroups(row.children)] : []))
const dollars = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`

function walk(rows: TreeRow[], open: string[], level: number, out: Flat[]): Flat[] {
  rows.forEach((row) => {
    out.push({ row, level })
    if (row.children && open.includes(row.id)) walk(row.children, open, level + 1, out)
  })
  return out
}

const find = (rows: TreeRow[], id: string): TreeRow | undefined => {
  for (const row of rows) {
    if (row.id === id) return row
    const hit = row.children && find(row.children, id)
    if (hit) return hit
  }
  return undefined
}

/** Rows that roll up. Only open branches render. Selecting rows totals their spend in the footer. */
export function TreeTable({ rows, defaultExpanded, defaultSelected = [], format = dollars, renderIcon, animated = true, style }: TreeTableProps) {
  const styles = useThemed(makeStyles)
  const first = useMemo(() => defaultExpanded ?? (rows[0] ? [rows[0].id] : []), [defaultExpanded, rows])
  const [open, setOpen] = useState(first)
  const [picked, setPicked] = useState(defaultSelected)
  const flat = useMemo(() => walk(rows, open, 0, []), [rows, open])
  const total = picked.reduce((sum, id) => sum + (find(rows, id)?.monthly ?? 0), 0)
  const toggle = (id: string): void => setOpen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))
  const allOn = flat.length > 0 && flat.every(({ row }) => picked.includes(row.id))
  const anyOpen = open.length > 0

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.card}>
        <Table renderIcon={renderIcon} animated={animated} minWidth={560}>
          <TableHeader>
            <TableRow>
              <TableHead type="checkbox"><Checkbox accessibilityLabel="Select all visible rows" checked={allOn} indeterminate={picked.length > 0 && !allOn} onCheckedChange={(on: boolean) => setPicked(on ? flat.map(({ row }) => row.id) : [])} animated={animated} /></TableHead>
              <TableHead>
                <View style={styles.nameHead}>
                  <IconButton variant="ghost" size="sm" icon={renderIcon(anyOpen ? 'minus' : 'plus', 14)} label={anyOpen ? 'Collapse all' : 'Expand all'} animated={animated} onPress={() => setOpen(anyOpen ? [] : allGroups(rows))} />
                  <Text style={styles.headText}>Name</Text>
                </View>
              </TableHead>
              <TableHead>Owner</TableHead>
              <TableHead type="number" width={96}>Resources</TableHead>
              <TableHead type="amount" width={96}>Monthly</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flat.map(({ row, level }) => {
              const on = picked.includes(row.id)
              return (
                <TableRow key={row.id} selected={on}>
                  <TableCell type="checkbox"><Checkbox accessibilityLabel={`Select ${row.name}`} checked={on} onCheckedChange={(next: boolean) => setPicked((list) => (next ? [...list, row.id] : list.filter((id) => id !== row.id)))} animated={animated} /></TableCell>
                  <TableCell type="tree" level={level} {...(row.children ? { expanded: open.includes(row.id), onToggle: () => toggle(row.id) } : {})} {...(row.sub ? { sub: row.sub } : {})}>{row.name}</TableCell>
                  <TableCell>{row.owner}</TableCell>
                  <TableCell type="number" width={96}>{row.resources}</TableCell>
                  <TableCell type="amount" width={96}>{format(row.monthly)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </View>
      <View style={styles.footer}>
        <Text accessibilityLiveRegion="polite" style={styles.summary}>{picked.length ? <><Text style={styles.total}>{picked.length} rows</Text> · <Text style={styles.total}>{format(total)}</Text></> : `${flat.length} rows`}</Text>
        {picked.length ? <Button variant="ghost" size="sm" leadingIcon={renderIcon('x', 14)} onPress={() => setPicked([])} animated={animated}>Clear</Button> : null}
        <Button variant="secondary" shape="pill" size="sm" leadingIcon={renderIcon('refresh-cw', 14)} onPress={() => setOpen(first)} animated={animated}>Reset</Button>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  card: { overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  nameHead: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  headText: type(12, c.textSecondary, '500'),
  footer: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], paddingHorizontal: space[3] },
  summary: { ...type(12, c.textSecondary), flex: 1 },
  total: { fontWeight: '500', color: c.textPrimary },
})
