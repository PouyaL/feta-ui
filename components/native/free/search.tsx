import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputInstance, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInRight, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors, hscroll } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { useFocusRing } from './input'
import { iconFor } from './label'
import { Spinner } from './spinner'

const HOLD_MS = 400
const RUN_MS = 800
const FAST_MS = 150
const ROW = { stiffness: 320, damping: 30, mass: 1 } as const
const SETTLE = { stiffness: 420, damping: 42, mass: 1 } as const
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const pageIn = FadeInRight.springify().stiffness(ROW.stiffness).damping(ROW.damping).mass(ROW.mass).withInitialValues({ opacity: 0, transform: [{ translateX: 12 }] })
const dropIn = FadeInUp.springify().stiffness(SETTLE.stiffness).damping(SETTLE.damping).mass(SETTLE.mass).withInitialValues({ opacity: 0, transform: [{ translateY: -4 }] })
const rowMove = LinearTransition.springify().stiffness(ROW.stiffness).damping(ROW.damping).mass(ROW.mass)

function Match({ text, query }: { text: string; query: string }) {
  const styles = useThemed(createStyles)
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return <>{text.slice(0, at)}<Text style={styles.match}>{text.slice(at, at + query.length)}</Text>{text.slice(at + query.length)}</>
}

export type SearchFieldProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** Swaps the search icon for a spinner. */
  loading?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A search pill. Typing shows a clear button. */
export function SearchField({ value, defaultValue = '', onValueChange, placeholder = 'Search', loading, disabled = false, accessibilityLabel = 'Search', renderIcon, animated = true, style }: SearchFieldProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const input = useRef<TextInputInstance>(null)
  const [held, setHeld] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const ring = useFocusRing(focused, false, still)
  const text = value ?? held
  const set = (next: string): void => { setHeld(next); onValueChange?.(next) }

  return (
    <Animated.View style={[styles.field, disabled && styles.disabled, ring, style]}>
      {loading ? <Spinner size={16} label={null} color={colors.textSecondary} animated={animated} /> : iconFor(renderIcon, 'search', 16, colors.textSecondary)}
      <TextInput
        ref={input}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="search"
        aria-disabled={disabled}
        autoCorrect={false}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
        style={styles.entry}
        value={text}
        onBlur={() => setFocused(false)}
        onChangeText={set}
        onFocus={() => setFocused(true)}
      />
      {text ? <IconButton variant="ghost" size="sm" animated={animated} label="Clear" icon={iconFor(renderIcon, 'x', 16, colors.textSecondary)} onPress={() => { set(''); input.current?.focus() }} /> : null}
    </Animated.View>
  )
}

export type PaletteItem = { page?: PalettePage; id: string; title: string; description?: string; icon?: ReactNode; shortcut?: string; chevron?: boolean; disabled?: boolean; /** Resolve when the command has finished. */ run?: () => void | Promise<void> }
export type PaletteGroup = { label: string; items: PaletteItem[] }
/** A nested page: choosing the item opens it instead of running. */
export type PalettePage = { label: string; placeholder?: string; groups: PaletteGroup[] }

export type CommandPaletteProps = {
  groups: PaletteGroup[]
  placeholder?: string
  /** Shown when nothing matches. */
  empty?: ReactNode
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Find anything and run commands: the field on the tray, results in the inset card. */
export function CommandPalette({ groups, placeholder = 'Search or run a command', empty = 'No results', renderIcon, animated = true, style }: CommandPaletteProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pages, setPages] = useState<PalettePage[]>([])
  const page = pages[pages.length - 1]
  const [state, setState] = useState<Record<string, 'running' | 'done'>>({})
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // A ref, so a second press in the same tick already sees the first run.
  const running = useRef(new Set<string>())

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (page?.groups ?? groups).map((group) => ({ ...group, items: group.items.filter((item) => !q || item.title.toLowerCase().includes(q)) })).filter((group) => group.items.length)
  }, [groups, page, query])
  const flat = shown.flatMap((group) => group.items)
  const enabled = flat.filter((item) => !item.disabled)
  const current = enabled[Math.min(active, enabled.length - 1)]

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function back(): void {
    setPages((all) => all.slice(0, -1))
    setQuery('')
    setActive(0)
  }

  async function runItem(item: PaletteItem | undefined): Promise<void> {
    if (!item || item.disabled || running.current.has(item.id)) return
    if (item.page) {
      const next = item.page
      setPages((all) => [...all, next])
      setQuery('')
      setActive(0)
      return
    }
    running.current.add(item.id)
    const settle = (from: 'running' | 'done'): void => setState((s) => {
      if (s[item.id] !== from) return s
      const { [item.id]: _gone, ...rest } = s
      return rest
    })
    setState((s) => ({ ...s, [item.id]: 'running' }))
    try {
      await (item.run ? item.run() : new Promise<void>((done) => timers.current.push(setTimeout(done, RUN_MS))))
      setState((s) => ({ ...s, [item.id]: 'done' }))
      timers.current.push(setTimeout(() => settle('done'), HOLD_MS * 4))
    } catch {
      // `run` reports its own failure; here the spinner just stops, with no tick.
      settle('running')
    } finally {
      running.current.delete(item.id)
    }
  }

  return (
    <View style={[styles.palette, style]}>
      <View style={styles.head}>
        {page ? (
          <Pressable accessibilityLabel={`Back from ${page.label}`} accessibilityRole="button" hitSlop={12} style={styles.pageChip} onPress={back}>
            <Text style={styles.pageText}>{page.label}</Text>
          </Pressable>
        ) : iconFor(renderIcon, 'search', 16, colors.textSecondary)}
        <TextInput
          accessibilityLabel="Command"
          autoCorrect={false}
          placeholder={page?.placeholder ?? placeholder}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="go"
          style={styles.entry}
          value={query}
          onChangeText={(next) => { setQuery(next); setActive(0) }}
          onSubmitEditing={() => void runItem(current)}
        />
      </View>
      <Animated.View key={pages.length} {...(still || pages.length === 0 ? {} : { entering: pageIn })} accessibilityLabel="Results" style={styles.body}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {flat.length ? shown.map((group) => (
            <Animated.View key={group.label} {...(still ? {} : { entering: FadeIn.duration(FAST_MS), exiting: FadeOut.duration(FAST_MS) })}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.items.map((item) => {
                const status = state[item.id]
                const on = item === current
                return (
                  <Pressable
                    key={item.id}
                    accessibilityHint={item.description}
                    accessibilityLabel={item.title}
                    accessibilityRole="menuitem"
                    aria-busy={status === 'running'}
                    aria-disabled={Boolean(item.disabled)}
                    aria-selected={on}
                    disabled={item.disabled ?? false}
                    style={[styles.item, on && styles.itemOn, item.disabled && styles.itemOff]}
                    onPress={() => void runItem(item)}
                    onPressIn={() => setActive(enabled.indexOf(item))}
                  >
                    <View style={[styles.tile, on && styles.tileOn, status === 'done' && styles.tileDone]}>
                      {status === 'running' ? <Spinner size={16} label={null} color={colors.textPrimary} animated={animated} /> : status === 'done' ? iconFor(renderIcon, 'tick-02', 16, colors.textInverse) : item.icon}
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.title}><Match text={item.title} query={query.trim()} /></Text>
                      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
                    </View>
                    {item.chevron ? iconFor(renderIcon, 'arrow-right', 16, colors.textSecondary) : null}
                  </Pressable>
                )
              })}
            </Animated.View>
          )) : <Animated.Text {...(still ? {} : { entering: FadeIn.duration(FAST_MS) })} style={styles.empty}>{empty}</Animated.Text>}
        </ScrollView>
      </Animated.View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{flat.length} {flat.length === 1 ? 'result' : 'results'}</Text>
    </View>
  )
}

export type MotionSearchItem = { id: string; title: string; description?: string; icon?: ReactNode }

export type MotionSearchProps = {
  items: MotionSearchItem[]
  onSelect?: (item: MotionSearchItem) => void
  placeholder?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A full width pill, with results dropping out of it while it has focus. */
export function MotionSearch({ items, onSelect, placeholder = 'Search', renderIcon, animated = true, style }: MotionSearchProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const input = useRef<TextInputInstance>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ring = useFocusRing(open, false, still)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => !q || item.title.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q))
  }, [items, query])
  const current = shown[Math.min(active, shown.length - 1)]

  function choose(item: MotionSearchItem | undefined): void {
    if (!item) return
    onSelect?.(item)
    setOpen(false)
    input.current?.blur()
  }

  return (
    <View style={[styles.motion, style]}>
      <Animated.View style={[styles.field, ring]}>
        {iconFor(renderIcon, 'search', 16, colors.textSecondary)}
        <TextInput
          ref={input}
          accessibilityLabel={placeholder}
          accessibilityRole="search"
          aria-expanded={open}
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          style={styles.entry}
          value={query}
          onBlur={() => setOpen(false)}
          onChangeText={(next) => { setQuery(next); setActive(0); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onSubmitEditing={() => choose(current)}
        />
      </Animated.View>
      {open ? (
        <Animated.View {...(still ? {} : { entering: dropIn, exiting: FadeOut.duration(FAST_MS) })} style={styles.motionCard}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.motionList}>
            {shown.map((item) => (
              <Pressable
                key={item.id}
                accessibilityHint={item.description}
                accessibilityLabel={item.title}
                accessibilityRole="menuitem"
                aria-selected={item === current}
                style={[styles.item, item === current && styles.itemOn]}
                onPress={() => choose(item)}
                onPressIn={() => setActive(shown.indexOf(item))}
              >
                {item.icon ? <View style={styles.tile}>{item.icon}</View> : null}
                <View style={styles.itemBody}>
                  <Text style={styles.title}><Match text={item.title} query={query.trim()} /></Text>
                  {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
                </View>
              </Pressable>
            ))}
            {shown.length ? null : <Text style={styles.empty}>No results</Text>}
          </ScrollView>
          <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{shown.length} {shown.length === 1 ? 'RESULT' : 'RESULTS'}</Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

export type ResultFacet = { label: string; options: { value: string; label: string }[] }
export type SearchResult = { id: string; title: string; path: string; snippet: string; author: string; initials: string; icon?: ReactNode; edited: number; facets: string[] }

export type SearchResultsProps = {
  query: string
  results: SearchResult[]
  facets: ResultFacet[]
  /** How long the search took, in seconds. */
  took?: number
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Sort = 'best' | 'newest' | 'az'
const SORTS: { value: Sort; label: string }[] = [{ value: 'best', label: 'Best match' }, { value: 'newest', label: 'Newest' }, { value: 'az', label: 'A to Z' }]

function Snippet({ text, query }: { text: string; query: string }) {
  const styles = useThemed(createStyles)
  const parts = query ? text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')) : [text]
  return <>{parts.map((part, i) => (i % 2 ? <Text key={i} style={styles.match}>{part}</Text> : part))}</>
}

/** A results page: filter chips, and highlighted results. */
export function SearchResults({ query, results, facets, took, renderIcon, animated = true, style }: SearchResultsProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [text, setText] = useState(query)
  const [on, setOn] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('best')
  const toggle = (value: string): void => setOn((all) => (all.includes(value) ? all.filter((v) => v !== value) : [...all, value]))
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase()
    const list = results.filter((r) => (!q || `${r.title} ${r.snippet}`.toLowerCase().includes(q)) && facets.every((facet) => {
      const picked = facet.options.filter((option) => on.includes(option.value))
      return !picked.length || picked.some((option) => r.facets.includes(option.value))
    }))
    if (sort === 'newest') return [...list].sort((a, b) => b.edited - a.edited)
    if (sort === 'az') return [...list].sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [results, facets, on, text, sort])

  return (
    <View accessibilityLabel="Search results" style={[styles.results, style]}>
      <SearchField value={text} onValueChange={setText} accessibilityLabel="Search" animated={animated} {...(renderIcon ? { renderIcon } : {})} />
      <ScrollView style={hscroll} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {facets.flatMap((facet) => facet.options).map((option) => {
          const pressed = on.includes(option.value)
          return (
            <Pressable key={option.value} accessibilityLabel={option.label} accessibilityRole="button" aria-selected={pressed} hitSlop={6} style={[styles.chip, pressed && styles.chipOn]} onPress={() => toggle(option.value)}>
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={styles.resultsCard}>
        <View style={styles.resultsHead}>
          <Text accessibilityLiveRegion="polite" style={styles.resultsCount}><Text style={styles.resultsNumber}>{shown.length}</Text> results{took ? ` in ${took} s` : ''}</Text>
          <View accessibilityLabel="Sort" style={styles.sorts}>
            {SORTS.map((option) => (
              <Pressable key={option.value} accessibilityLabel={option.label} accessibilityRole="button" aria-selected={sort === option.value} hitSlop={9} style={[styles.sort, sort === option.value && styles.sortOn]} onPress={() => setSort(option.value)}>
                <Text style={[styles.sortText, sort === option.value && styles.sortTextOn]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {shown.map((result) => (
          <Animated.View key={result.id} {...(still ? {} : { entering: FadeIn.duration(FAST_MS).easing(OUT), exiting: FadeOut.duration(FAST_MS), layout: rowMove })} style={styles.result}>
            {result.icon ? <View style={styles.tile}>{result.icon}</View> : null}
            <View style={styles.resultBody}>
              <Text style={styles.title}>{result.title}</Text>
              <Text style={styles.description}>{result.path}</Text>
              <Text style={styles.snippet}><Snippet text={result.snippet} query={text.trim()} /></Text>
              <View style={styles.author}>
                <View style={styles.authorAvatar}><Text style={styles.authorInitials}>{result.initials}</Text></View>
                <Text style={styles.authorName}>{result.author}</Text>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  field: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[2], height: 44, paddingLeft: space[3], paddingRight: space[2], width: '100%' },
  disabled: { opacity: 0.5 },
  entry: { color: c.textPrimary, flex: 1, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), minWidth: 0, paddingVertical: 0 },
  match: { fontWeight: '600', textDecorationLine: 'underline' },
  palette: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1], width: '100%' },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[2], height: 44, paddingHorizontal: space[3] },
  pageChip: { backgroundColor: c.ink5, borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: space[1] },
  pageText: type(12, c.textPrimary, '500'),
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, maxHeight: 320, minHeight: 120, padding: space[1] },
  groupLabel: { ...type(10, c.textTertiary, '400', true), paddingBottom: space[1], paddingHorizontal: space[2], paddingTop: space[2], textTransform: 'uppercase' },
  item: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row', gap: space[2], minHeight: 44, paddingHorizontal: space[3], paddingVertical: space[2] },
  itemOn: { backgroundColor: c.ink5 },
  itemOff: { opacity: 0.4 },
  tile: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.lg, height: 28, justifyContent: 'center', width: 28 },
  tileOn: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  tileDone: { backgroundColor: c.success },
  itemBody: { flex: 1, minWidth: 0 },
  title: type(16, c.textPrimary, '500'),
  description: type(12, c.textSecondary),
  empty: { ...type(14, c.textSecondary), paddingHorizontal: space[3], paddingVertical: space[8], textAlign: 'center' },
  status: { height: 0, opacity: 0 },
  motion: { width: '100%' },
  motionCard: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, marginTop: space[1.5], overflow: 'hidden' },
  motionList: { maxHeight: 280, padding: space[1.5] },
  resultCount: { ...type(10, c.textTertiary, '400', true), paddingHorizontal: space[3], paddingVertical: space[2] },
  results: { backgroundColor: c.ink4, borderRadius: radius.tray, gap: space[2], padding: space[1.5], width: '100%' },
  chips: { gap: space[1.5] },
  chip: { alignItems: 'center', backgroundColor: c.surface, borderColor: 'transparent', borderRadius: radius.full, borderWidth: 1.5, height: 32, justifyContent: 'center', paddingHorizontal: space[2.5] },
  chipOn: { borderColor: c.textPrimary },
  chipText: type(14, c.textPrimary, '500'),
  resultsCard: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space[2] },
  resultsHead: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'space-between', paddingBottom: space[2], paddingHorizontal: space[2], paddingTop: space[1] },
  resultsCount: type(12, c.textSecondary),
  resultsNumber: { color: c.textPrimary, fontWeight: '600' },
  sorts: { flexDirection: 'row', gap: space[0.5] },
  sort: { alignItems: 'center', borderRadius: radius.full, height: 26, justifyContent: 'center', paddingHorizontal: space[2] },
  sortOn: { backgroundColor: c.ink5 },
  sortText: type(12, c.textSecondary, '500'),
  sortTextOn: { color: c.textPrimary },
  result: { borderRadius: radius.control, flexDirection: 'row', gap: space[2], padding: space[3] },
  resultBody: { flex: 1, gap: space[0.5], minWidth: 0 },
  snippet: { ...type(14, c.textSecondary), marginVertical: space[1] },
  author: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  authorAvatar: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 18, justifyContent: 'center', width: 18 },
  authorInitials: type(10, c.textTertiary, '500'),
  authorName: type(12, c.textTertiary),
})
