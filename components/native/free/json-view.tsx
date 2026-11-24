import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Input } from './input'

const SUMMARY_KEYS = 3
const ROW_INDENT = 20
const TURN_MS = 160

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonBranch = JsonValue[] | { [key: string]: JsonValue }
type Row = { path: string; key: string; value: JsonValue; depth: number; open: boolean; branch: boolean }

const isBranch = (value: JsonValue): value is JsonBranch => typeof value === 'object' && value !== null
const childPath = (path: string, key: string | number): string => (typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`)
const entries = (value: JsonBranch): [string | number, JsonValue][] => (Array.isArray(value) ? value.map((item, i) => [i, item]) : Object.entries(value))
const countLabel = (value: JsonBranch): string => (Array.isArray(value) ? `${value.length} items` : `${Object.keys(value).length} keys`)
const summary = (value: JsonBranch): string => {
  if (Array.isArray(value)) return '[…]'
  const keys = Object.keys(value)
  return `{ ${keys.slice(0, SUMMARY_KEYS).join(', ')}${keys.length > SUMMARY_KEYS ? ', …' : ''} }`
}

function allMatches(rootName: string, root: JsonValue, query: string): string[] {
  const found: string[] = []
  const needle = query.toLowerCase()
  const walk = (path: string, key: string, value: JsonValue): void => {
    const text = isBranch(value) ? '' : String(value)
    if (key.toLowerCase().includes(needle) || text.toLowerCase().includes(needle)) found.push(path)
    if (isBranch(value)) for (const [k, v] of entries(value)) walk(childPath(path, k), String(k), v)
  }
  walk(rootName, rootName, root)
  return found
}

export type JsonViewProps = {
  data: JsonValue
  rootName?: string
  /** The request line on the tray. */
  request?: { method: string; path: string; status: number; duration?: string }
  /** Key paths open at the start. Default just the root. */
  defaultOpen?: string[]
  hint?: ReactNode
  /** React Native ships no clipboard, so the app writes the text. */
  onCopy: (text: string) => void | Promise<void>
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Chevron({ open, still, renderIcon }: { open: boolean; still: boolean; renderIcon: RenderIcon }) {
  const turn = useSharedValue(open ? 90 : 0)
  useEffect(() => {
    turn.value = still ? (open ? 90 : 0) : withTiming(open ? 90 : 0, { duration: TURN_MS })
  }, [open, still, turn])
  const motion = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return <Animated.View style={motion}>{renderIcon('chevron-right', 14)}</Animated.View>
}

/** An API response explorer: a tree you can fold, search and copy from. */
export function JsonView({ data, rootName = 'order', request, defaultOpen, hint, onCopy, renderIcon, animated = true, style }: JsonViewProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ?? [rootName]))
  const [selected, setSelected] = useState(rootName)
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState(0)
  const matches = useMemo(() => (query ? allMatches(rootName, data, query) : []), [query, data, rootName])
  // While searching, only the branches that lead to a match are open.
  const forced = useMemo(() => {
    const set = new Set<string>()
    for (const path of matches) for (const part of path.matchAll(/[.[]/g)) set.add(path.slice(0, part.index))
    return set
  }, [matches])

  const rows = useMemo(() => {
    const out: Row[] = []
    const onlyMatches = Boolean(query)
    const walk = (path: string, key: string, value: JsonValue, depth: number): void => {
      if (onlyMatches && !forced.has(path) && !matches.includes(path)) return
      const branch = isBranch(value)
      const shown = branch && (onlyMatches ? forced.has(path) : open.has(path))
      out.push({ path, key, value, depth, open: shown, branch })
      if (shown) for (const [k, v] of entries(value)) walk(childPath(path, k), String(k), v, depth + 1)
    }
    walk(rootName, rootName, data, 0)
    return out
  }, [data, rootName, open, forced, matches, query])

  const selectedValue = rows.find((row) => row.path === selected)?.value ?? data

  function toggle(path: string): void {
    setOpen((set) => {
      const next = new Set(set)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function allBranches(): Set<string> {
    const set = new Set<string>()
    const walk = (path: string, value: JsonValue): void => {
      if (!isBranch(value)) return
      set.add(path)
      for (const [k, v] of entries(value)) walk(childPath(path, k), v)
    }
    walk(rootName, data)
    return set
  }

  function go(by: number): void {
    if (!matches.length) return
    const next = (hit + by + matches.length) % matches.length
    setHit(next)
    const path = matches[next]
    if (path) setSelected(path)
  }

  return (
    <View style={[styles.tray, style]}>
      {request ? (
        <View style={styles.request}>
          <Text style={styles.method}>{request.method}</Text>
          <Text style={styles.path} numberOfLines={1}>{request.path}</Text>
          <Text style={request.status < 400 ? styles.statusOk : styles.statusBad}>{request.status}</Text>
          {request.duration ? <Text style={styles.path}>{request.duration}</Text> : null}
        </View>
      ) : null}
      <View style={styles.card}>
        <View style={styles.search}>
          <Input accessibilityLabel="Search keys and values" placeholder="Search" value={query} onChangeText={(text: string) => { setQuery(text); setHit(0) }} leading={renderIcon('search', 16)} animated={animated} />
          {query ? (
            <View style={styles.hits}>
              <Text accessibilityLiveRegion="polite" style={styles.count}>{matches.length ? `${Math.min(hit, matches.length - 1) + 1} of ${matches.length}` : 'No matches'}</Text>
              <IconButton variant="ghost" size="sm" icon={renderIcon('arrow-up', 16)} label="Previous match" animated={animated} onPress={() => go(-1)} />
              <IconButton variant="ghost" size="sm" icon={renderIcon('arrow-down', 16)} label="Next match" animated={animated} onPress={() => go(1)} />
              <IconButton variant="ghost" size="sm" icon={renderIcon('x', 16)} label="Clear search" animated={animated} onPress={() => setQuery('')} />
            </View>
          ) : null}
        </View>
        <View style={styles.tree}>
          {rows.map((row) => {
            const on = row.path === selected
            return (
              <Pressable
                key={row.path}
                accessibilityRole={row.branch ? 'button' : 'text'}
                accessibilityLabel={row.branch ? `${row.key}, ${countLabel(row.value as JsonBranch)}` : `${row.key}, ${String(row.value)}`}
                aria-selected={on}
                {...(row.branch ? { 'aria-expanded': row.open } : {})}
                onPress={() => { setSelected(row.path); if (row.branch) toggle(row.path) }}
                style={[styles.row, styles[`depth_${Math.min(row.depth, 5)}` as 'depth_0'], on ? styles.rowOn : null]}
              >
                {row.branch ? <Chevron open={row.open} still={still} renderIcon={renderIcon} /> : <View style={styles.leafGap} />}
                <Text style={styles.key}>{row.key}</Text>
                <Text style={styles.colon}>:</Text>
                {row.branch
                  ? <Text style={styles.punct} numberOfLines={1}>{row.open ? countLabel(row.value as JsonBranch) : summary(row.value as JsonBranch)}</Text>
                  : <Text style={typeof row.value === 'string' ? styles.string : row.value === null ? styles.punct : styles.attr} numberOfLines={1}>{typeof row.value === 'string' ? `"${row.value}"` : String(row.value)}</Text>}
              </Pressable>
            )
          })}
        </View>
        <View style={styles.footer}>
          <IconButton variant="ghost" size="sm" icon={renderIcon('plus', 16)} label="Expand all" animated={animated} onPress={() => setOpen(allBranches())} />
          <IconButton variant="ghost" size="sm" icon={renderIcon('minus', 16)} label="Collapse all" animated={animated} onPress={() => setOpen(new Set([rootName]))} />
          <View style={styles.spacer} />
          <IconButton variant="ghost" size="sm" icon={renderIcon('link', 16)} label="Copy path" animated={animated} onPress={() => { void onCopy(selected) }} />
          <IconButton variant="ghost" size="sm" icon={renderIcon('copy', 16)} label="Copy value" animated={animated} onPress={() => { void onCopy(JSON.stringify(selectedValue, null, 2)) }} />
        </View>
      </View>
      {typeof hint === 'string' ? <Text style={styles.hint}>{hint}</Text> : hint}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  request: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 36, paddingHorizontal: space[3] },
  method: type(12, c.textPrimary, '500', true),
  path: { ...type(12, c.textSecondary, '400', true), flexShrink: 1 },
  statusOk: type(12, c.success, '500', true),
  statusBad: type(12, c.danger, '500', true),
  card: { overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  search: { gap: space[1], padding: space[2], borderBottomWidth: 1, borderBottomColor: c.ink5 },
  hits: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  count: { ...type(12, c.textTertiary, '400', true), flex: 1 },
  tree: { paddingVertical: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 44, paddingRight: space[3] },
  rowOn: { backgroundColor: c.ink4 },
  depth_0: { paddingLeft: space[2] },
  depth_1: { paddingLeft: space[2] + ROW_INDENT },
  depth_2: { paddingLeft: space[2] + ROW_INDENT * 2 },
  depth_3: { paddingLeft: space[2] + ROW_INDENT * 3 },
  depth_4: { paddingLeft: space[2] + ROW_INDENT * 4 },
  depth_5: { paddingLeft: space[2] + ROW_INDENT * 5 },
  leafGap: { width: 14 },
  key: type(12, c.textPrimary, '500', true),
  colon: type(12, c.textTertiary, '400', true),
  string: { ...type(12, c.textSecondary, '400', true), flexShrink: 1 },
  attr: { ...type(12, c.textPrimary, '400', true), flexShrink: 1 },
  punct: { ...type(12, c.textTertiary, '400', true), flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', padding: space[1], borderTopWidth: 1, borderTopColor: c.ink5 },
  spacer: { flex: 1 },
  hint: { ...type(12, c.textTertiary), paddingVertical: space[2], paddingHorizontal: space[3] },
})
