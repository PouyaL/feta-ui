import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, pressedState, radius, space, useColors, type Colors } from '../kit'
import { withInk, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { KbdGroup } from './kbd'

const SUMMARY_KEYS = 3
const ROW_INDENT = 20
const COPIED_MS = 2000
const TURN_MS = 160

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonBranch = JsonValue[] | { [key: string]: JsonValue }
type Row = { path: string; key: string; value: JsonValue; depth: number; open: boolean; branch: boolean }

const isBranch = (value: JsonValue): value is JsonBranch => typeof value === 'object' && value !== null
const childPath = (path: string, key: string | number): string => (typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`)
const entries = (value: JsonBranch): [string | number, JsonValue][] => (Array.isArray(value) ? value.map((item, i) => [i, item]) : Object.entries(value))
const countLabel = (value: JsonBranch): string => (Array.isArray(value) ? `${value.length} items` : `${Object.keys(value).length} keys`)
const typeLabel = (value: JsonValue): string => {
  if (Array.isArray(value)) return `array, ${value.length} items`
  if (value === null) return 'null'
  if (typeof value === 'object') return `object, ${Object.keys(value).length} keys`
  if (typeof value === 'string') return `string, ${value.length} chars`
  return typeof value
}
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

function Chevron({ open, still, renderIcon, color }: { open: boolean; still: boolean; renderIcon: RenderIcon; color: string }) {
  const turn = useSharedValue(open ? 90 : 0)
  useEffect(() => {
    turn.value = still ? (open ? 90 : 0) : withTiming(open ? 90 : 0, { duration: TURN_MS })
  }, [open, still, turn])
  const motion = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return <Animated.View style={motion}>{withInk(renderIcon('chevron-right', 14), color)}</Animated.View>
}

/** An API response explorer: a tree you can fold, search and copy from. */
export function JsonView({ data, rootName = 'order', request, defaultOpen, hint, onCopy, renderIcon, animated = true, style }: JsonViewProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(copiedTimer.current), [])
  const icon = (name: string, size = 16, color: string = colors.textSecondary): ReactNode => withInk(renderIcon(name, size), color)
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

  async function copy(text: string): Promise<void> {
    clearTimeout(copiedTimer.current)
    try {
      await onCopy(text)
      setCopied(true)
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      setCopied(false)
    }
  }

  const none = Boolean(query) && !matches.length

  return (
    <View style={[styles.tray, style]}>
      {request ? (
        <View style={styles.request}>
          <Text style={styles.method}>{request.method}</Text>
          <Text style={styles.path} numberOfLines={1}>{request.path}</Text>
          <View style={[styles.dot, request.status >= 400 && styles.dotBad]} />
          <Text style={[styles.status, request.status >= 400 && styles.statusBad]}>{request.status}</Text>
          {request.duration ? <Text style={styles.duration}>{request.duration}</Text> : null}
        </View>
      ) : null}
      <View style={styles.card}>
        <View style={styles.toolbar}>
          <View style={[styles.search, query ? styles.searchOn : null]}>
            {icon('search', 14)}
            <TextInput
              accessibilityLabel="Search keys and values"
              placeholder="Search keys and values"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              value={query}
              onChangeText={(text) => { setQuery(text); setHit(0) }}
              onSubmitEditing={() => go(1)}
              style={styles.searchInput}
            />
            {query
              ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12} onPress={() => { setQuery(''); setHit(0) }} style={styles.clear}>{icon('x', 12)}</Pressable>
              : <KbdGroup keys={['⌘', 'K']} size="sm" animated={animated} style={SELF.center} />}
          </View>
          {query ? (
            <>
              <Text accessibilityLiveRegion="polite" style={styles.matchCount}>{matches.length ? `${Math.min(hit, matches.length - 1) + 1} of ${matches.length}` : '0 matches'}</Text>
              <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('arrow-up', 16, colors.textPrimary)} label="Previous match" disabled={!matches.length} animated={animated} onPress={() => go(-1)} />
              <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('arrow-down', 16, colors.textPrimary)} label="Next match" disabled={!matches.length} animated={animated} onPress={() => go(1)} />
            </>
          ) : (
            <>
              <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('plus', 16, colors.textPrimary)} label="Expand all" animated={animated} onPress={() => setOpen(allBranches())} />
              <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('minus', 16, colors.textPrimary)} label="Collapse all" animated={animated} onPress={() => setOpen(new Set())} />
            </>
          )}
        </View>
        {none ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>{icon('search', 14)}</View>
            <Text style={styles.emptyTitle}>No keys or values match “{query}”</Text>
            <Text style={styles.emptyHint}>Search looks through every nested key and value.</Text>
          </View>
        ) : (
          // The web caps the tree at 340 px and scrolls inside it, so the footer stays in view.
          <ScrollView accessibilityLabel={`${rootName} response`} style={styles.treeScroll} contentContainerStyle={styles.tree} nestedScrollEnabled>
            {rows.map((row) => {
              const on = row.path === selected
              return (
                <View key={row.path} style={[styles.rowWrap, on ? styles.rowOn : null]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={row.branch ? `${row.key}, ${countLabel(row.value as JsonBranch)}` : `${row.key}, ${String(row.value)}`}
                    {...pressedState(on)}
                    {...(row.branch ? { 'aria-expanded': row.open } : {})}
                    onPress={() => { setSelected(row.path); if (row.branch && !query) toggle(row.path) }}
                    style={[styles.row, styles[`depth_${Math.min(row.depth, 5)}` as 'depth_0']]}
                  >
                    <View style={styles.caret}>{row.branch ? <Chevron open={row.open} still={still} renderIcon={renderIcon} color={colors.textSecondary} /> : null}</View>
                    <Text style={styles.key}>{row.key}: </Text>
                    {row.branch
                      ? <>{row.open ? null : <Text style={styles.punct} numberOfLines={1}>{summary(row.value as JsonBranch)}</Text>}<Text style={styles.count} numberOfLines={1}>{countLabel(row.value as JsonBranch)}</Text></>
                      : <Text style={[styles.leaf, typeof row.value === 'string' ? styles.string : row.value === null ? styles.punct : styles.attr]} numberOfLines={1}>{typeof row.value === 'string' ? `"${row.value}"` : String(row.value)}</Text>}
                  </Pressable>
                  {on ? (
                    <View style={styles.actions}>
                      <IconButton variant="ghost" size="sm" icon={icon('copy', 16, colors.textPrimary)} label="Copy value" animated={animated} onPress={() => { void copy(JSON.stringify(row.value, null, 2)) }} />
                      <IconButton variant="ghost" size="sm" icon={icon('link', 16, colors.textPrimary)} label="Copy path" animated={animated} onPress={() => { void copy(row.path) }} />
                    </View>
                  ) : null}
                </View>
              )
            })}
          </ScrollView>
        )}
        <View style={styles.footer}>
          <Text style={styles.footPath} numberOfLines={1}>{none ? rootName : selected}</Text>
          {none ? null : <Text style={styles.footType}>{typeLabel(selectedValue)}</Text>}
          {copied ? <Text accessibilityLiveRegion="polite" style={styles.footType}>Copied</Text> : null}
          <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('copy', 16, colors.textPrimary)} label="Copy the selected value" animated={animated} onPress={() => { void copy(JSON.stringify(selectedValue, null, 2)) }} />
        </View>
      </View>
      {typeof hint === 'string' ? <Text style={styles.hint}>{hint}</Text> : hint}
    </View>
  )
}

// Syntax colours: the web's --feta-code-* tokens.
const LIGHT_CODE = { string: '#006b2d', attr: '#704b00', punct: '#6b6b6b' }
const DARK_CODE: typeof LIGHT_CODE = { string: '#86d49e', attr: '#e3b263', punct: '#9a9a9a' }

const makeStyles = (c: Colors) => {
  const k = c.canvas === '#ffffff' ? LIGHT_CODE : DARK_CODE
  const mono = { fontFamily: font.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0 }
  return StyleSheet.create({
    tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
    request: { flexDirection: 'row', alignItems: 'center', gap: space[2], height: 36, paddingHorizontal: space[3] },
    method: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
    path: { ...mono, color: c.textPrimary, flex: 1, minWidth: 0 },
    dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: c.success },
    dotBad: { backgroundColor: c.danger },
    status: { ...mono, color: c.textPrimary },
    statusBad: { color: c.danger },
    duration: { ...mono, color: c.textTertiary },
    card: { overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: space[1], padding: space[2], borderBottomWidth: 1, borderBottomColor: c.ink5 },
    search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[1.5], minWidth: 0, height: 36, paddingHorizontal: space[2.5], borderRadius: radius.full, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: c.ink4 },
    searchOn: { borderColor: c.textPrimary, backgroundColor: c.surface },
    searchInput: { ...type(12, c.textPrimary), flex: 1, minWidth: 0, padding: 0 },
    clear: { alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: radius.full, backgroundColor: c.ink8 },
    matchCount: { ...mono, color: c.textTertiary },
    tree: { padding: space[1] },
    treeScroll: { maxHeight: 340 },
    rowWrap: { justifyContent: 'center', borderRadius: radius.lg },
    // The web's 30 px rows.
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 30, paddingRight: space[2] },
    rowOn: { backgroundColor: c.ink5 },
    depth_0: { paddingLeft: space[2] },
    depth_1: { paddingLeft: space[2] + ROW_INDENT },
    depth_2: { paddingLeft: space[2] + ROW_INDENT * 2 },
    depth_3: { paddingLeft: space[2] + ROW_INDENT * 3 },
    depth_4: { paddingLeft: space[2] + ROW_INDENT * 4 },
    depth_5: { paddingLeft: space[2] + ROW_INDENT * 5 },
    caret: { width: 16 },
    // The web sets 500 on a mono with a medium cut; Menlo has none and would jump to bold, so keys stay regular.
    key: { ...mono, color: c.textPrimary },
    leaf: { ...mono, flexShrink: 1 },
    string: { color: k.string },
    attr: { color: k.attr },
    punct: { ...mono, color: k.punct, flexShrink: 1 },
    count: { ...mono, color: c.textTertiary, marginLeft: space[2], flexShrink: 0 },
    actions: { position: 'absolute', right: 2, flexDirection: 'row', borderRadius: radius.lg, backgroundColor: c.surface },
    empty: { alignItems: 'center', paddingVertical: space[8], paddingHorizontal: space[4] },
    emptyIcon: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36, marginBottom: space[2], borderRadius: radius.full, backgroundColor: c.ink5 },
    emptyTitle: { ...type(16, c.textPrimary, '500'), lineHeight: 22, textAlign: 'center' },
    emptyHint: { ...type(12, c.textSecondary), lineHeight: 16, marginTop: space[1], textAlign: 'center' },
    footer: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 36, paddingLeft: space[3], paddingRight: space[1], borderTopWidth: 1, borderTopColor: c.ink5 },
    footPath: { ...mono, color: c.textPrimary, flexShrink: 1, minWidth: 0 },
    footType: { ...mono, color: c.textSecondary, marginLeft: 'auto' },
    hint: { ...type(12, c.textSecondary), lineHeight: 16, paddingTop: space[2], paddingHorizontal: space[3], paddingBottom: space[1] },
  })
}
