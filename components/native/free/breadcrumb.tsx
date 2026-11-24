import { useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInRight, FadeOutRight, LinearTransition } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { DropdownMenu } from './dropdown-menu'
import { IconButton } from './icon-button'
import { EASE_OUT, Mark, openLink, soft, Tap, useCompact } from './popover'
import { Skeleton } from './skeleton'

const ENTER_X = 8
const FADE_MS = 200
const MAX_CRUMBS = 4
const COMPACT_CRUMBS = 3
const MENU_WIDTH = 200

const SLIDE = LinearTransition.springify().stiffness(420).damping(34)
const CRUMB_IN = FadeInRight.duration(FADE_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: ENTER_X }] })
const CRUMB_OUT = FadeOutRight.duration(150).easing(EASE_OUT)
const LABEL_IN = FadeIn.duration(FADE_MS).easing(EASE_OUT)

export type BreadcrumbItem = { label: string; href?: string; icon?: ReactNode; onPress?: () => void }

export type BreadcrumbSeparatorProps = { type?: 'chevron' | 'slash' | 'dot'; size?: 'sm' | 'md' }

/** Decorative, so it stays out of the accessibility tree. */
export function BreadcrumbSeparator({ type: kind = 'chevron', size = 'md' }: BreadcrumbSeparatorProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const small = size === 'sm'
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.separator, small && styles.separatorSmall]}>
      {kind === 'chevron' ? <Mark name="chevron-right" size={small ? 14 : 16} color={colors.textTertiary} /> : kind === 'slash' ? <Text style={styles.slash}>/</Text> : <View style={styles.dot} />}
    </View>
  )
}

function follow(item: BreadcrumbItem): void {
  if (item.onPress) item.onPress()
  else if (item.href) openLink(item.href)
}

function Crumb({ item, small, tray, animated }: { item: BreadcrumbItem; small: boolean; tray: boolean; animated: boolean }) {
  const styles = useThemed(createStyles)
  const compact = useCompact()
  const iconOnly = Boolean(item.icon) && compact
  return (
    <Tap accessibilityRole="link" accessibilityLabel={item.label} animated={animated} hitSlop={small ? 4 : 0} onPress={() => follow(item)} style={[styles.link, small && styles.linkSmall, tray && styles.linkTray, iconOnly && styles.linkIconOnly, iconOnly && small && styles.linkIconOnlySmall]}>
      {item.icon ?? null}
      {iconOnly ? null : <Text numberOfLines={1} style={[styles.linkLabel, small && styles.labelSmall]}>{item.label}</Text>}
    </Tap>
  )
}

export type BreadcrumbProps = {
  /** From the root to the current page. The last item is the current page. */
  items: BreadcrumbItem[]
  /** `tray` lifts the path onto a tray, with the current page as a chip. Default `plain`. */
  appearance?: 'plain' | 'tray'
  size?: 'sm' | 'md'
  separator?: BreadcrumbSeparatorProps['type']
  /** Holds the current page's place with a skeleton. */
  loading?: boolean
  /** Longer paths fold their middle into a menu, as does any path too wide to fit. */
  maxItems?: number
  'aria-label'?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Shows where the current page sits. New crumbs slide in and the current chip glides to its spot. */
export function Breadcrumb({ items, appearance = 'plain', size = 'md', separator = 'chevron', loading = false, maxItems = MAX_CRUMBS, 'aria-label': label = 'Breadcrumb', animated = true, style }: BreadcrumbProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const compact = useCompact()
  const [narrow, setNarrow] = useState(false)
  const room = useRef(0)
  const needed = useRef(0)
  const small = size === 'sm'
  const tray = appearance === 'tray'

  // Folding is decided by width, not count. The width it took to fit is kept to know when to unfold.
  function check(): void {
    if (!room.current) return
    if (needed.current > room.current) setNarrow(true)
    else if (room.current >= needed.current) setNarrow(false)
  }

  function onRoom(e: LayoutChangeEvent): void {
    room.current = e.nativeEvent.layout.width
    check()
  }

  function onList(e: LayoutChangeEvent): void {
    const { width } = e.nativeEvent.layout
    if (!narrow) { needed.current = width; check() }
  }

  const limit = Math.min(maxItems, compact ? COMPACT_CRUMBS : maxItems)
  const fold = items.length > 2 && (narrow || items.length > limit)
  const head = fold ? items.slice(0, 1) : items.slice(0, -1)
  const hidden = fold ? items.slice(1, -2) : []
  const tail = fold ? items.slice(hidden.length ? -2 : 1, -1) : []
  const current = items[items.length - 1]
  const links = [...head, ...tail]
  const gap = <BreadcrumbSeparator type={separator} size={size} />
  const moves = still ? {} : { layout: SLIDE }
  const shift = still ? {} : { entering: CRUMB_IN, exiting: CRUMB_OUT }

  return (
    <View accessibilityLabel={label} onLayout={onRoom} style={[styles.breadcrumb, style]}>
      <View onLayout={onList} style={[styles.list, tray && styles.tray]}>
        {links.map((item, index) => (
          <Animated.View key={item.href ?? item.label} {...shift} {...moves} style={styles.item}>
            {index === head.length && hidden.length ? (
              <>
                <DropdownMenu
                  label="Hidden levels"
                  animated={animated}
                  width={MENU_WIDTH}
                  entries={hidden.map((level) => ({ label: level.label, onSelect: () => follow(level) }))}
                  trigger={(props) => <IconButton {...props} variant="ghost" size={size} label="Show hidden levels" icon={<Mark name="more" />} animated={animated} />}
                />
                {gap}
              </>
            ) : null}
            <Crumb item={item} small={small} tray={tray} animated={animated} />
            {gap}
          </Animated.View>
        ))}
        {current ? (
          <Animated.View {...moves} accessibilityRole="text" aria-selected accessibilityLabel={loading ? `${current.label}, loading` : current.label} style={[styles.current, small && styles.linkSmall, tray && !loading && styles.chip]}>
            {loading ? <Skeleton width={72} height={12} animated={animated} /> : <Animated.Text key={current.label} {...(still ? {} : { entering: LABEL_IN })} numberOfLines={1} style={[styles.currentLabel, small && styles.labelSmall]}>{current.label}</Animated.Text>}
          </Animated.View>
        ) : null}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  breadcrumb: { alignSelf: 'stretch', overflow: 'hidden' },
  list: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
  tray: { backgroundColor: c.ink4, borderRadius: radius.full, padding: space[1] },
  item: { alignItems: 'center', flexDirection: 'row', flexShrink: 0 },
  link: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row', gap: space[1.5], height: 44, paddingHorizontal: space[2.5] },
  linkSmall: { height: 36 },
  linkTray: { borderRadius: radius.full },
  linkIconOnly: { justifyContent: 'center', paddingHorizontal: 0, width: 44 },
  linkIconOnlySmall: { width: 36 },
  linkLabel: { ...type(14, c.textSecondary), lineHeight: 20 },
  labelSmall: { fontSize: 13, letterSpacing: font.tracking(13), lineHeight: 18 },
  separator: { alignItems: 'center', height: 20, justifyContent: 'center', width: 20 },
  separatorSmall: { height: 16, width: 16 },
  // No line height: iOS puts the extra leading above the glyph, which sat the slash low beside the labels.
  slash: type(14, c.textTertiary),
  dot: { backgroundColor: c.textTertiary, borderRadius: radius.full, height: 4, width: 4 },
  current: { alignItems: 'center', flexDirection: 'row', height: 44, paddingHorizontal: space[3] },
  chip: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1 },
  currentLabel: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
})
