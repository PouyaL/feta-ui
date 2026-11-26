import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextInputInstance, type ViewStyle } from 'react-native'
import Animated, { ZoomIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { font, pressedState, radius, softElevation, space, type Colors } from '../kit'
import { Button, SELF } from './button'
import { type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Input } from './input'
import { RollingText } from './label'
import { EASE_OUT, Mark, useCompact } from './popover'
import { Select } from './select'

/** Pages shown around the current one in Numbered and Jump. */
const SIBLINGS = 1
const SLIDE = { stiffness: 420, damping: 34 }
const ITEM = 40
const ITEM_GAP = 2
const TRAY_PADDING = 4
const REACH = 2
const LOAD_MS = 240
const DOT = 6
const DOT_LONG = 20
const DOT_GAP = 8
const DOT_MS = 200
const JUMP_IN = ZoomIn.duration(200).easing(EASE_OUT).withInitialValues({ transform: [{ scale: 0.8 }] })

/** The first, the last, and the current with its neighbours. `null` is an ellipsis. */
export function pageRange(page: number, pages: number, siblings = SIBLINGS): (number | null)[] {
  const wanted = [...new Set([1, pages, ...Array.from({ length: siblings * 2 + 1 }, (_, i) => page - siblings + i)])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  return wanted.flatMap((n, i) => {
    const before = wanted[i - 1]
    if (before === undefined || n - before === 1) return [n]
    return n - before === 2 ? [before + 1, n] : [null, n]
  })
}

export type PageItemProps = {
  page: number
  active?: boolean
  disabled?: boolean
  onSelect?: (page: number) => void
  /** Rolls the digits that change when the page under this slot changes. */
  still?: boolean
}

/** One page in the tray. The pill lives on its own layer, so the numbers never move. */
export function PageItem({ page, active = false, disabled = false, onSelect, still = true }: PageItemProps) {
  const styles = useThemed(createStyles)
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Page ${page}`} {...pressedState(active)} aria-disabled={disabled} disabled={disabled} hitSlop={REACH} onPress={() => onSelect?.(page)} style={styles.item}>
      <RollingText value={String(page)} still={still} style={[styles.number, active && styles.numberOn]} />
    </Pressable>
  )
}

function Tray({ list, current, still, children }: { list: (number | null)[]; current: number; still: boolean; children: ReactNode }) {
  const styles = useThemed(createStyles)
  const at = Math.max(0, list.indexOf(current)) * (ITEM + ITEM_GAP)
  const x = useSharedValue(at)
  const first = useRef(true)
  useEffect(() => {
    x.value = still || first.current ? at : withSpring(at, SLIDE)
    first.current = false
  }, [at, still, x])
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  return (
    <View style={styles.tray}>
      {list.includes(current) ? <Animated.View pointerEvents="none" style={[styles.pill, pill]} /> : null}
      {children}
    </View>
  )
}

function Dot({ n, current, seen, still, onSelect }: { n: number; current: number; seen: number; still: boolean; onSelect: (page: number) => void }) {
  const styles = useThemed(createStyles)
  const on = n === current
  const width = useSharedValue(on ? DOT_LONG : DOT)
  const shift = useSharedValue(n > current ? DOT_LONG - DOT : 0)
  useEffect(() => {
    const timing = { duration: still ? 0 : DOT_MS, easing: EASE_OUT }
    width.value = withTiming(on ? DOT_LONG : DOT, timing)
    shift.value = withTiming(n > current ? DOT_LONG - DOT : 0, timing)
  }, [current, n, on, shift, still, width])
  const dot = useAnimatedStyle(() => ({ width: width.value, transform: [{ translateX: shift.value }] }))
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Go to slide ${n}`} {...pressedState(on)} hitSlop={{ top: 10, bottom: 10 }} onPress={() => onSelect(n)} style={styles.dotButton}>
      <Animated.View style={[styles.dot, n <= seen && styles.dotSeen, on && styles.dotOn, dot]} />
    </Pressable>
  )
}

export type PaginationProps = {
  /** Default `numbered`. */
  kind?: 'simple' | 'numbered' | 'compact' | 'table' | 'jump' | 'load-more' | 'dots'
  /** Number of pages. For `dots`, the number of slides. */
  pages?: number
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  /** `table`: rows on one page. */
  perPage?: number
  perPageOptions?: number[]
  onPerPageChange?: (perPage: number) => void
  /** `table` and `load-more`: rows in all. */
  total?: number
  /** `load-more`: rows showing now. */
  shown?: number
  /** `load-more`: rows one press adds. */
  step?: number
  onLoadMore?: () => void
  'aria-label'?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Ways to move through pages. The current page lifts onto surface and slides to where you tapped. */
export function Pagination({ kind = 'numbered', pages = 12, page, defaultPage = 1, onPageChange, perPage = 25, perPageOptions = [10, 25, 50, 100], onPerPageChange, total = 0, shown = 0, step = 20, onLoadMore, 'aria-label': label = 'Pagination', animated = true, style }: PaginationProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  // Phones follow the web's Mobile frame: Numbered fills one row with 44 arrows at the ends and only first, current
  // and last between them; Table drops Rows per page; Compact spaces its arrows 16 from the count.
  const phone = useCompact()
  const [held, setHeld] = useState(defaultPage)
  const [heldPer, setHeldPer] = useState(perPage)
  const [seen, setSeen] = useState(defaultPage)
  const [jumping, setJumping] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const field = useRef<TextInputInstance>(null)
  const current = page ?? held
  const fill = useSharedValue(total ? shown / total : 0)

  useEffect(() => { setSeen((most) => Math.max(most, current)) }, [current])
  useEffect(() => { if (jumping !== null) field.current?.focus() }, [jumping])
  useEffect(() => {
    fill.value = withTiming(total ? shown / total : 0, { duration: still ? 0 : LOAD_MS, easing: EASE_OUT })
  }, [fill, shown, still, total])

  const progress = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }))

  function go(next: number): void {
    const target = Math.max(1, Math.min(pages, next))
    setHeld(target)
    onPageChange?.(target)
  }

  function submit(): void {
    const target = Number.parseInt(typed, 10)
    if (Number.isFinite(target)) go(target)
    setTyped('')
    setJumping(null)
  }

  const arrow = (direction: -1 | 1, variant: 'ghost' | 'secondary' = 'ghost', size: 'sm' | 'md' = 'sm'): ReactNode => (
    <IconButton variant={variant} size={size} style={styles.arrow} animated={animated} label={direction < 0 ? 'Previous page' : 'Next page'} icon={<Mark name={direction < 0 ? 'chevron-left' : 'chevron-right'} />} disabled={direction < 0 ? current <= 1 : current >= pages} onPress={() => go(current + direction)} />
  )

  const tray = (list: (number | null)[]): ReactNode => (
    <Tray list={list} current={current} still={still}>
      {list.map((entry, i) => (entry === null ? (
        jumping === i ? (
          <Animated.View key={`jump-${i}`} {...(still ? {} : { entering: JUMP_IN })} style={styles.inlineJump}>
            <Input ref={field} size="sm" keyboardType="number-pad" accessibilityLabel="Go to page" returnKeyType="go" value={typed} onChangeText={setTyped} onSubmitEditing={submit} onBlur={() => setJumping(null)} animated={animated} />
          </Animated.View>
        ) : (
          <Pressable key={`gap-${i}`} accessibilityRole="button" accessibilityLabel="Jump to a page" hitSlop={REACH} onPress={() => setJumping(i)} style={styles.item}><Mark name="more" /></Pressable>
        )
      ) : <PageItem key={`slot-${i}`} page={entry} active={entry === current} onSelect={go} still={still} />))}
    </Tray>
  )

  const body = (): ReactNode => {
    switch (kind) {
      case 'simple':
        return tray(Array.from({ length: pages }, (_, i) => i + 1))
      case 'compact':
        return (
          <View style={[styles.row, phone && styles.compactPhone]}>
            {arrow(-1, 'ghost', phone ? 'md' : 'sm')}
            <Text style={styles.status}>Page <Text style={styles.strong}>{current}</Text> of {pages}</Text>
            {arrow(1, 'ghost', phone ? 'md' : 'sm')}
          </View>
        )
      case 'table': {
        const per = perPage === heldPer ? perPage : heldPer
        const from = (current - 1) * per + 1
        const to = Math.min(current * per, total)
        return (
          <View style={[styles.row, styles.spread, phone && styles.phoneRow]}>
            {phone ? null : (
              <View style={styles.perPage}>
                <Text style={styles.status}>Rows per page</Text>
                <Select kind="pill" accessibilityLabel="Rows per page" animated={animated} value={String(per)} onValueChange={(v) => { setHeldPer(Number(v)); onPerPageChange?.(Number(v)) }} options={perPageOptions.map((n) => ({ value: String(n), label: String(n) }))} style={styles.perSelect} />
              </View>
            )}
            <Text style={phone ? styles.rangePhone : styles.range}>{from} to {to} of {total}</Text>
            <View style={[styles.row, phone && styles.pagerPhone]}>{arrow(-1, 'secondary', phone ? 'md' : 'sm')}{arrow(1, 'secondary', phone ? 'md' : 'sm')}</View>
          </View>
        )
      }
      case 'jump':
        return (
          <View style={styles.row}>
            {tray(pageRange(current, pages, 0))}
            <View style={styles.row}>
              <Text style={styles.status}>Go to</Text>
              <Input size="sm" keyboardType="number-pad" accessibilityLabel="Go to page" returnKeyType="go" value={typed} onChangeText={setTyped} onSubmitEditing={submit} animated={animated} style={styles.jumpInput} />
              <Button style={SELF.center} variant="secondary" size="sm" animated={animated} onPress={submit}>Go</Button>
            </View>
          </View>
        )
      case 'load-more':
        return (
          <View style={styles.load}>
            <Text style={styles.status}>Showing <Text style={styles.strong}>{shown}</Text> of {total}</Text>
            <View accessibilityRole="progressbar" accessibilityLabel="Loaded" aria-valuemin={0} aria-valuemax={total} aria-valuenow={shown} style={styles.track}>
              <Animated.View style={[styles.fill, progress]} />
            </View>
            {shown < total ? <Button style={SELF.center} variant="secondary" size="sm" animated={animated} onPress={onLoadMore}>{`Load ${Math.min(step, total - shown)} more`}</Button> : null}
          </View>
        )
      case 'dots':
        return (
          <View style={styles.dots}>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Dot key={n} n={n} current={current} seen={seen} still={still} onSelect={go} />)}
          </View>
        )
      default:
        return (
          <View style={[styles.row, phone && styles.phoneRow]}>
            {arrow(-1, 'secondary', phone ? 'md' : 'sm')}
            {tray(pageRange(current, pages, phone ? 0 : SIBLINGS))}
            {arrow(1, 'secondary', phone ? 'md' : 'sm')}
          </View>
        )
    }
  }

  const fills = kind === 'table' || (phone && kind === 'numbered')
  return <View accessibilityLabel={label} style={[fills ? styles.full : styles.pagination, style]}>{body()}</View>
}

const createStyles = (c: Colors) => StyleSheet.create({
  pagination: { alignSelf: 'flex-start', maxWidth: '100%' },
  full: { alignSelf: 'stretch' },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  spread: { flex: 1, justifyContent: 'space-between' },
  phoneRow: { flexWrap: 'nowrap', justifyContent: 'space-between', width: '100%' },
  compactPhone: { gap: space[4] },
  pagerPhone: { flexWrap: 'nowrap', gap: space[1] },
  arrow: { alignSelf: 'center' },
  tray: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius['2xl'], flexDirection: 'row', gap: ITEM_GAP, padding: TRAY_PADDING },
  pill: { boxShadow: softElevation(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.xl, borderWidth: 1, height: ITEM, left: TRAY_PADDING, position: 'absolute', top: TRAY_PADDING, width: ITEM },
  item: { alignItems: 'center', borderRadius: radius.xl, height: ITEM, justifyContent: 'center', minWidth: ITEM },
  number: { color: c.textSecondary, fontFamily: font.mono, fontSize: 14, lineHeight: 20 },
  numberOn: { color: c.textPrimary },
  status: { ...type(14, c.textSecondary), lineHeight: 20 },
  strong: { color: c.textPrimary, fontFamily: font.mono, fontWeight: '500', letterSpacing: 0 },
  perPage: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  perSelect: { width: 80 },
  range: { color: c.textPrimary, fontFamily: font.mono, fontSize: 12, lineHeight: 16 },
  rangePhone: { ...type(14, c.textSecondary), lineHeight: 18 },
  jumpInput: { width: 56 },
  inlineJump: { width: 56 },
  load: { alignItems: 'center', gap: space[2] },
  track: { backgroundColor: c.ink8, borderRadius: radius.full, height: 4, maxWidth: '100%', overflow: 'hidden', width: 200 },
  fill: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: '100%', transformOrigin: 'left', width: '100%' },
  dots: { alignItems: 'center', flexDirection: 'row', gap: DOT_GAP, height: 24 },
  dotButton: { height: 24, justifyContent: 'center', width: DOT },
  dot: { backgroundColor: c.ink10, borderRadius: radius.full, height: DOT },
  dotSeen: { backgroundColor: c.textSecondary },
  dotOn: { backgroundColor: c.textPrimary },
})
