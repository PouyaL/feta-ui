import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg'
import { font, space, useColors, type Colors } from '../kit'
import { Card, type, useStill, useThemed } from './card'
import { ToggleGroup } from './toggle-group'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
/** Below this width the card shows the last 16 weeks. */
const COMPACT_WIDTH = 400
const COMPACT_WEEKS = 16
/** Terrain toggle: pillars rise over 600 ms with 8 ms between weeks. */
const RISE_MS = 600
const RISE_STAGGER = 8
/** A vertical drag this long on the terrain changes the camera. */
const CAMERA_DRAG = 24
const LAYER = { duration: 240, easing: EASE_OUT }
const DIM = { duration: 150, easing: EASE_OUT }
const DIMMED = 0.5
const cameraIn = FadeIn.duration(240).easing(EASE_OUT)
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_MS = 86400000
/** Flat grid measures. */
const LABEL_WIDTH = 28
const GAP = 4
const CELL = { web: 18, mobile: 14 } as const
const AREA = { web: 300, mobile: 220 } as const
const MONTH_ROW = 20
const SWATCH = 10
type Level = 0 | 1 | 2 | 3 | 4
/** One finished color per level, keyed so every lookup is defined. */
type Ramp = Readonly<Record<Level, string>>
const LEVELS: readonly Level[] = [0, 1, 2, 3, 4]
const ramp = (pick: (step: Level) => string): Ramp => ({ 0: pick(0), 1: pick(1), 2: pick(2), 3: pick(3), 4: pick(4) })
/** Tone shares of the ink over the surface, opaque so the walls can shade them. */
const LEVEL_SHARE: Readonly<Record<Level, number>> = { 0: 0.05, 1: 0.1, 2: 0.4, 3: 0.6, 4: 1 }
/** Walls are the tone with 55% black. */
const WALL_SHADE = 0.45
const CHIP_HEIGHT = 20

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Projections measured from the Terrain and Orbit frames, Web and Mobile. */
type Camera = { width: number; height: number; origin: [number, number]; week: [number, number]; day: [number, number]; front: [number, number]; side: [number, number]; unit: number; floor: number }
const CAMERAS: Record<'terrain' | 'orbit', Record<'web' | 'mobile', Camera>> = {
  terrain: {
    web: { width: 624, height: 300, origin: [112.7, 76.8], week: [17.5, 5.5], day: [-10.5, 7], front: [15.05, 4.73], side: [9.03, 6.02], unit: 4.8, floor: 1.5 },
    mobile: { width: 310, height: 220, origin: [65.6, 62.4], week: [14, 4.4], day: [-8.4, 5.6], front: [12.04, 3.78], side: [7.22, 4.82], unit: 3.84, floor: 1.2 },
  },
  orbit: {
    web: { width: 624, height: 300, origin: [81.8, 112.5], week: [19, 3], day: [-6, 11], front: [16.34, 2.58], side: [5.16, 9.46], unit: 6, floor: 1.5 },
    mobile: { width: 310, height: 220, origin: [46.8, 70.8], week: [15.2, 2.4], day: [-4.8, 8.8], front: [13.07, 2.07], side: [4.13, 7.57], unit: 4.8, floor: 1.2 },
  },
}

export type TerrainView = 'flat' | 'terrain' | 'orbit'

export type ActivityTerrainProps = {
  /** One array of seven daily counts per week, Sunday first, oldest week first. */
  weeks: number[][]
  /** The Sunday of the first week. */
  start: Date
  view?: TerrainView
  defaultView?: TerrainView
  onViewChange?: (view: TerrainView) => void
  /** Lights one day, as `[week, day]`, for documentation. */
  previewDay?: [number, number]
  /** Default `Activity`. */
  title?: string
  locale?: string
  /** `false` switches views at once. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const level = (count: number): Level => (count >= 8 ? 4 : count >= 5 ? 3 : count >= 3 ? 2 : count >= 1 ? 1 : 0)
const plural = (count: number): string => `${count} contribution${count === 1 ? '' : 's'}`

const channels = (hex: string): [number, number, number] => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
const toHex = (values: number[]): string => `#${values.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
const mix = (top: string, base: string, share: number): string => {
  const under = channels(base)
  return toHex(channels(top).map((value, index) => value * share + (under[index] ?? 0) * (1 - share)))
}
const shade = (tone: string): string => toHex(channels(tone).map((value) => value * WALL_SHADE))

type Tones = { top: Ramp; wall: Ramp; on: string; onWall: string; surface: string }

/** color-mix, worked out once per scheme because react-native-svg takes finished colors. */
const createTones = (c: Colors): Tones => {
  const top = ramp((step) => mix(c.textPrimary, c.surface, LEVEL_SHARE[step]))
  return { top, wall: ramp((step) => shade(top[step])), on: c.success, onWall: shade(c.success), surface: c.surface }
}

type Pillar = { index: number; column: number; count: number; x: number; y: number; height: number }

const wallPath = (x: number, y: number, fx: number, fy: number, sx: number, sy: number, lift: number): string => {
  'worklet'
  const ax = x + fx
  const left = `M${x} ${y + sy - lift}L${ax} ${y + sy + fy - lift}V${y + sy + fy}L${x} ${y + sy}Z`
  const right = `M${ax} ${y + fy + sy - lift}L${ax + sx} ${y + fy - lift}V${y + fy}L${ax} ${y + fy + sy}Z`
  return left + right
}

const topPath = (x: number, y: number, fx: number, fy: number, sx: number, sy: number, lift: number): string => {
  'worklet'
  return `M${x + sx} ${y - lift}L${x + sx + fx} ${y + fy - lift}L${x + fx} ${y + fy + sy - lift}L${x} ${y + sy - lift}Z`
}

/** Paths in place of the web's transforms: react-native-svg has no CSS transform transitions. */
function PillarShape({ pillar, camera, rise, tones, on }: { pillar: Pillar; camera: Camera; rise: SharedValue<number>; tones: Tones; on?: boolean }) {
  const { x, y, height, column, count } = pillar
  const [fx, fy] = camera.front
  const [sx, sy] = camera.side
  const delay = column * RISE_STAGGER
  const liftOf = (clock: number): number => {
    'worklet'
    return height * EASE_OUT(Math.max(0, Math.min(1, (clock - delay) / RISE_MS)))
  }
  const wallProps = useAnimatedProps(() => ({ d: wallPath(x, y, fx, fy, sx, sy, liftOf(rise.value)) }))
  const topProps = useAnimatedProps(() => ({ d: topPath(x, y, fx, fy, sx, sy, liftOf(rise.value)) }))
  const step = level(count)
  return (
    <>
      <AnimatedPath animatedProps={wallProps} fill={on ? tones.onWall : tones.wall[step]} stroke={tones.surface} strokeWidth={0.5} />
      <AnimatedPath animatedProps={topProps} fill={on ? tones.on : tones.top[step]} stroke={tones.surface} strokeWidth={0.5} />
    </>
  )
}

/** A contribution grid in five ink steps that rises into an isometric terrain. Tap or scrub to read a day. */
export function ActivityTerrain({ weeks, start, view, defaultView = 'flat', onViewChange, previewDay, title = 'Activity', locale = 'en-US', animated = true, style }: ActivityTerrainProps) {
  const styles = useThemed(createStyles)
  const tones = useThemed(createTones)
  const colors = useColors()
  const still = useStill(animated)
  const [width, setWidth] = useState(0)
  const [held, setHeld] = useState(defaultView)
  const [cursor, setCursor] = useState<number | null>(null)
  const current = view ?? held
  const flat = current === 'flat'
  const compact = width < COMPACT_WIDTH
  const platform = compact ? 'mobile' : 'web'
  const area = AREA[platform]

  const first = compact ? Math.max(weeks.length - COMPACT_WEEKS, 0) : 0
  const shown = useMemo(() => weeks.slice(first), [weeks, first])
  const total = useMemo(() => shown.flat().reduce((sum, count) => sum + count, 0), [shown])
  const date = useCallback((week: number, day: number): Date => new Date(start.getTime() + (week * 7 + day) * DAY_MS + DAY_MS / 2), [start])
  const dayName = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }), [locale])
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short' }), [locale])

  const months = useMemo(() => {
    const list: { column: number; name: string }[] = []
    let previous = -1
    shown.forEach((_, column) => {
      const month = date(first + column, 0).getMonth()
      if (month !== previous) list.push({ column, name: monthName.format(date(first + column, 0)) })
      previous = month
    })
    return list
  }, [shown, first, date, monthName])

  const preview = previewDay ? previewDay[0] * 7 + previewDay[1] : null
  const active = cursor ?? preview
  const activeWeek = active === null ? 0 : Math.floor(active / 7)
  const activeDay = active === null ? 0 : active % 7
  const activeCount = weeks[activeWeek]?.[activeDay] ?? 0
  const lit = active !== null && activeWeek >= first
  const subtitle = lit
    ? `${plural(activeCount)} on ${dayName.format(date(activeWeek, activeDay))}`
    : compact ? `${total} in the last ${shown.length} weeks` : `${plural(total)} in the last ${shown.length} weeks`

  const camera = CAMERAS[current === 'orbit' ? 'orbit' : 'terrain'][platform]
  const [fx, fy] = camera.front
  const [sx, sy] = camera.side
  // Columns paint oldest first and each runs back to front, which keeps nearer pillars on top.
  const pillars = useMemo(() => shown.flatMap((days, column) => days.map((count, day): Pillar => ({
    index: (first + column) * 7 + day,
    column,
    count,
    x: camera.origin[0] + column * camera.week[0] + day * camera.day[0],
    y: camera.origin[1] + column * camera.week[1] + day * camera.day[1],
    height: count ? count * camera.unit : camera.floor,
  }))), [shown, first, camera])

  // The flat grid is one drawing, so its cells do not need 112 views.
  const cell = Math.max(0, Math.min(CELL[platform], (width - LABEL_WIDTH - GAP * shown.length) / Math.max(shown.length, 1)))
  const pitch = cell + GAP
  const gridWidth = LABEL_WIDTH + GAP + shown.length * pitch - GAP
  const gridHeight = MONTH_ROW + 7 * pitch - GAP
  const gridLeft = Math.max(0, (width - gridWidth) / 2)
  const gridTop = Math.max(0, (area - gridHeight) / 2)
  const cellX = (column: number): number => gridLeft + LABEL_WIDTH + GAP + column * pitch
  const cellY = (row: number): number => gridTop + MONTH_ROW + row * pitch

  const rise = useSharedValue(flat ? 0 : RISE_MS + shown.length * RISE_STAGGER)
  const layer = useSharedValue(flat ? 0 : 1)
  const dim = useSharedValue(lit ? DIMMED : 1)
  useEffect(() => {
    const top = RISE_MS + shown.length * RISE_STAGGER
    // A full year is hundreds of animated paths, so only the 16 week view rises. The wide view crossfades.
    rise.value = still || !compact ? (flat ? 0 : top) : withTiming(flat ? 0 : top, { duration: top, easing: Easing.linear })
    layer.value = still ? (flat ? 0 : 1) : withTiming(flat ? 0 : 1, LAYER)
  }, [compact, flat, layer, rise, shown.length, still])
  useEffect(() => {
    dim.value = still ? (lit ? DIMMED : 1) : withTiming(lit ? DIMMED : 1, DIM)
  }, [dim, lit, still])

  const flatStyle = useAnimatedStyle(() => ({ opacity: interpolate(layer.value, [0, 1], [1, 0]) }))
  const riseStyle = useAnimatedStyle(() => ({ opacity: layer.value }))
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }))

  function choose(next: TerrainView): void {
    setHeld(next)
    onViewChange?.(next)
  }

  /** Finds the day under a finger. The terrain looks for the nearest pillar top in camera space. */
  function pick(x: number, y: number): void {
    let found: number | null = null
    if (flat) {
      const column = Math.floor((x - cellX(0) + GAP / 2) / pitch)
      const row = Math.floor((y - cellY(0) + GAP / 2) / pitch)
      if (column >= 0 && column < shown.length && row >= 0 && row < 7) found = (first + column) * 7 + row
    } else {
      const scale = Math.min(width / camera.width, area / camera.height)
      const px = (x - (width - camera.width * scale) / 2) / scale
      const py = (y - (area - camera.height * scale) / 2) / scale
      let nearest = (fx + sx) ** 2
      for (const { index, x: at, y: top, height } of pillars) {
        const distance = (px - at - (fx + sx) / 2) ** 2 + (py - top + height - (fy + sy) / 2) ** 2
        if (distance < nearest) { nearest = distance; found = index }
      }
    }
    setCursor(found)
  }

  function moveBy(step: number): void {
    const from = cursor ?? first * 7 - step
    const next = from + step
    if (next >= first * 7 && next < weeks.length * 7) setCursor(next)
  }

  const flipCamera = (): void => { if (!flat) choose(current === 'orbit' ? 'terrain' : 'orbit') }

  function handleAction({ nativeEvent }: AccessibilityActionEvent): void {
    if (nativeEvent.actionName === 'increment') moveBy(1)
    if (nativeEvent.actionName === 'decrement') moveBy(-1)
    if (nativeEvent.actionName === 'camera') flipCamera()
  }

  const latest = useRef({ pick, choose, current })
  latest.current = { pick, choose, current }
  const pickAt = useCallback((x: number, y: number) => latest.current.pick(x, y), [])
  const endCamera = useCallback((moved: number) => {
    const { choose: pickView, current: now } = latest.current
    if (moved > CAMERA_DRAG && now === 'terrain') pickView('orbit')
    if (moved < -CAMERA_DRAG && now === 'orbit') pickView('terrain')
  }, [])

  const gesture = useMemo(() => {
    const tap = Gesture.Tap().onEnd((event) => { runOnJS(pickAt)(event.x, event.y) })
    const scrub = Gesture.Pan().enabled(flat).activeOffsetX([-8, 8]).failOffsetY([-16, 16]).onUpdate((event) => { runOnJS(pickAt)(event.x, event.y) })
    const orbit = Gesture.Pan().enabled(!flat).activeOffsetY([-12, 12]).onEnd((event) => { runOnJS(endCamera)(event.translationY) })
    return Gesture.Race(tap, scrub, orbit)
  }, [endCamera, flat, pickAt])

  const chip = lit && !flat ? pillars.find(({ index }) => index === active) : undefined
  const chipText = chip ? String(chip.count) : ''
  const chipWidth = chipText.length * 8 + space[3]
  const activeColumn = activeWeek - first

  return (
    <Card animated={animated} style={[styles.terrain, style]} bodyStyle={styles.body}>
      <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.header}>
          <View style={styles.text}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.subtitle} accessibilityLiveRegion="polite">{subtitle}</Text>
          </View>
          <ToggleGroup type="single" label="View" value={flat ? 'flat' : 'terrain'} items={[{ value: 'flat', label: 'Flat' }, { value: 'terrain', label: 'Terrain' }]} animated={animated} onValueChange={(next) => choose(next === 'flat' ? 'flat' : 'terrain')} />
        </View>

        <GestureDetector gesture={gesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={flat ? `${title} grid` : `${title} terrain`}
            aria-valuetext={subtitle}
            aria-valuemin={first * 7}
            aria-valuemax={Math.max(first * 7, weeks.length * 7 - 1)}
            aria-valuenow={active ?? first * 7}
            accessibilityActions={flat ? [{ name: 'increment' }, { name: 'decrement' }] : [{ name: 'increment' }, { name: 'decrement' }, { name: 'camera', label: 'Change camera' }]}
            onAccessibilityAction={handleAction}
            style={[styles.area, compact ? styles.areaMobile : styles.areaWeb]}
          >
            <Animated.View pointerEvents={flat ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, flatStyle]}>
              {width > 0 ? (
                <>
                  <Animated.View style={[StyleSheet.absoluteFill, dimStyle]}>
                    <Svg aria-hidden width={width} height={area}>
                      {months.map(({ column, name }) => <SvgText key={column} x={cellX(column)} y={gridTop + 12} fontSize={12} fontFamily={font.sans} letterSpacing={font.tracking(12)} fill={colors.textTertiary}>{name}</SvgText>)}
                      {DAYS.map((day, row) => (row % 2 ? <SvgText key={day} x={gridLeft} y={cellY(row) + cell / 2 + 4} fontSize={12} fontFamily={font.sans} letterSpacing={font.tracking(12)} fill={colors.textTertiary}>{day}</SvgText> : null))}
                      {shown.map((days, column) => days.map((count, row) => <Rect key={`${column}-${row}`} x={cellX(column)} y={cellY(row)} width={cell} height={cell} rx={cell / 2} fill={tones.top[level(count)]} />))}
                    </Svg>
                  </Animated.View>
                  {lit && activeColumn >= 0 ? (
                    <Svg aria-hidden width={width} height={area} style={StyleSheet.absoluteFill}>
                      <Rect x={cellX(activeColumn)} y={cellY(activeDay)} width={cell} height={cell} rx={cell / 2} fill={tones.on} />
                    </Svg>
                  ) : null}
                </>
              ) : null}
            </Animated.View>

            <Animated.View pointerEvents={flat ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, riseStyle]}>
              <Animated.View key={current === 'orbit' ? 'orbit' : 'terrain'} {...(still ? {} : { entering: cameraIn })} style={StyleSheet.absoluteFill}>
                <Animated.View style={[StyleSheet.absoluteFill, dimStyle]}>
                  <Svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${camera.width} ${camera.height}`}>
                    {pillars.map((pillar) => <PillarShape key={pillar.index} pillar={pillar} camera={camera} rise={rise} tones={tones} />)}
                  </Svg>
                </Animated.View>
                {chip ? (
                  <Svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${camera.width} ${camera.height}`} style={StyleSheet.absoluteFill}>
                    <PillarShape pillar={chip} camera={camera} rise={rise} tones={tones} on />
                    <Rect x={chip.x + (fx + sx) / 2 - chipWidth / 2} y={chip.y - chip.height - CHIP_HEIGHT - space[1.5]} width={chipWidth} height={CHIP_HEIGHT} rx={CHIP_HEIGHT / 2} fill={colors.inverse} />
                    <SvgText x={chip.x + (fx + sx) / 2} y={chip.y - chip.height - space[1.5] - 6} fontSize={12} fontFamily={font.mono} textAnchor="middle" fill={colors.textInverse}>{chipText}</SvgText>
                  </Svg>
                ) : null}
              </Animated.View>
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.legendText}>Less</Text>
          <Svg aria-hidden width={LEVELS.length * (SWATCH + GAP) - GAP} height={SWATCH} style={styles.swatches}>
            {LEVELS.map((step) => <Rect key={step} x={step * (SWATCH + GAP)} width={SWATCH} height={SWATCH} rx={SWATCH / 2} fill={tones.top[step]} />)}
          </Svg>
          <Text style={styles.legendText}>More</Text>
        </View>
      </View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  terrain: { maxWidth: 672, width: '100%' },
  body: { paddingBottom: space[4.5], paddingHorizontal: space[5], paddingTop: space[5] },
  frame: { gap: space[3], minWidth: 0 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
  text: { flex: 1, gap: space[0.5], minWidth: 0 },
  title: type(14, c.textPrimary, '500'),
  subtitle: { ...type(14, c.textSecondary), lineHeight: 18 },
  area: { overflow: 'hidden' },
  areaWeb: { height: AREA.web },
  areaMobile: { height: AREA.mobile },
  legend: { alignItems: 'center', flexDirection: 'row', gap: space[1], justifyContent: 'flex-end' },
  legendText: type(12, c.textTertiary),
  swatches: { marginHorizontal: space[1] },
})
