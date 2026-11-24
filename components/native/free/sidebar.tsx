import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ScrollView, StyleSheet, Text, View, type ViewInstance, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { withInk } from './button'
import { type, useStill, useThemed } from './card'
import { MenuTurn } from './dropdown-menu'
import { EASE_OUT, openLink, soft, Tap } from './popover'
import { Tooltip } from './tooltip'

const COLLAPSED_WIDTH = 64
const RAIL_CLIP = 200
const COLLAPSE_MS = 260
const FADE_MS = 120
const SLIDE = { stiffness: 420, damping: 34 }
const WIDTH = { rail: 264, drawer: 320 }
const SUBS_IN = FadeInUp.duration(FADE_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: -4 }] })
const SUBS_OUT = FadeOut.duration(FADE_MS)

type Box = { x: number; y: number; width: number; height: number }
type Glide = { host: RefObject<ViewInstance | null>; place: (box: Box) => void }

// The active surface sits on the list, not the row, so it can glide across groups of any depth.
const GlideContext = createContext<Glide | null>(null)

/** A list whose active surface glides between its NavItems. */
function GlideList({ showing, still, children }: { showing: boolean; still: boolean; children: ReactNode }) {
  const styles = useThemed(createStyles)
  const host = useRef<ViewInstance>(null)
  const seen = useRef(false)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const width = useSharedValue(0)
  const height = useSharedValue(0)

  const glide = useMemo<Glide>(() => ({
    host,
    place: (box) => {
      const move = (to: number): number => (still || !seen.current ? to : withSpring(to, SLIDE))
      x.value = move(box.x)
      y.value = move(box.y)
      width.value = move(box.width)
      height.value = move(box.height)
      seen.current = true
    },
  }), [height, still, width, x, y])

  const surface = useAnimatedStyle(() => ({ height: height.value, width: width.value, transform: [{ translateX: x.value }, { translateY: y.value }] }))

  return (
    <View ref={host} collapsable={false} style={styles.glideHost}>
      {showing ? <Animated.View pointerEvents="none" style={[styles.surface, surface]} /> : null}
      <GlideContext.Provider value={glide}>{children}</GlideContext.Provider>
    </View>
  )
}

export type NavItemProps = {
  label: string
  /** `sub` sits on a rail under a parent. `trigger` is a pill that opens a menu. */
  kind?: 'item' | 'sub' | 'trigger'
  icon?: ReactNode
  count?: number | string | undefined
  /** Shows a chevron, turned when `open`. */
  chevron?: boolean
  open?: boolean
  active?: boolean
  disabled?: boolean
  /** Opened when there is no `onPress`. */
  href?: string | undefined
  /** Drops the label: the 64 wide rail. */
  rail?: boolean
  animated?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/** The shared navigation row. */
export function NavItem({ label, kind = 'item', icon, count, chevron = false, open = false, active = false, disabled = false, href, rail = false, animated = true, onPress, style }: NavItemProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const glide = useContext(GlideContext)
  const row = useRef<ViewInstance>(null)
  const sub = kind === 'sub'
  const trigger = kind === 'trigger'

  function report(): void {
    const host = glide?.host.current
    if (active && host) row.current?.measureLayout(host, (x, y, width, height) => glide?.place({ x, y, width, height }))
  }

  useEffect(report)

  return (
    <View ref={row} collapsable={false} onLayout={report} style={[trigger ? styles.triggerWrap : null, style]}>
      {active && !glide ? <View style={[styles.surface, styles.surfaceFill]} /> : null}
      <Tap
        accessibilityRole={href === undefined ? 'button' : 'link'}
        accessibilityLabel={label}
        aria-selected={active}
        aria-disabled={disabled}
        {...(chevron ? { 'aria-expanded': open } : {})}
        animated={animated}
        disabled={disabled}
        onPress={() => { if (onPress) onPress(); else if (href) openLink(href) }}
        style={[styles.item, trigger && styles.trigger, trigger && open && styles.triggerOpen, rail && styles.itemRail, disabled && styles.off]}
      >
        {withInk(icon, active ? colors.textPrimary : colors.textSecondary)}
        {rail ? null : <Text numberOfLines={1} style={[styles.label, active && styles.labelActive, sub && !active && styles.labelSub, trigger && styles.labelTrigger]}>{label}</Text>}
        {count === undefined ? null : <Text style={rail ? styles.countRail : styles.count}>{count}</Text>}
        {chevron && !rail ? <MenuTurn open={open} still={still} color={colors.textSecondary} /> : null}
      </Tap>
      {sub && active ? <View style={styles.subMark} /> : null}
    </View>
  )
}

export type SidebarLink = { id: string; label: string; icon?: ReactNode; count?: number | string; disabled?: boolean; items?: SidebarLink[] }
export type SidebarSection = { label?: string; links: SidebarLink[] }

export type SidebarProps = {
  sections: SidebarSection[]
  /** Brand or account row at the top. */
  header?: ReactNode
  /** Under the header, like a search field. Hidden on the rail. */
  search?: ReactNode
  /** A card above the footer, like an upgrade offer. Hidden on the rail. */
  promo?: ReactNode
  footer?: ReactNode
  /** Links under the sections, like Settings. */
  bottomLinks?: SidebarLink[]
  active?: string
  defaultActive?: string
  onNavigate?: (id: string) => void
  /** The 64 wide icon rail. */
  collapsed?: boolean
  /** `drawer` is the 320 wide layout for phones. */
  mode?: 'rail' | 'drawer'
  /** Groups open at the start. */
  defaultOpen?: string[]
  'aria-label'?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const holds = (links: SidebarLink[], id: string | undefined): boolean => links.some((link) => link.id === id || holds(link.items ?? [], id))

/** How people move through an app. The active surface glides between rows, and the bar collapses to an icon rail. */
export function Sidebar({ sections, header, search, promo, footer, bottomLinks = [], active, defaultActive, onNavigate, collapsed = false, mode = 'rail', defaultOpen = [], 'aria-label': label = 'Main', animated = true, style }: SidebarProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultActive)
  const [open, setOpen] = useState(defaultOpen)
  const current = active ?? held
  const rail = collapsed && mode === 'rail'
  const full = mode === 'drawer' ? WIDTH.drawer : WIDTH.rail
  const width = useSharedValue(rail ? COLLAPSED_WIDTH : full)

  useEffect(() => {
    width.value = withTiming(rail ? COLLAPSED_WIDTH : full, { duration: still ? 0 : COLLAPSE_MS, easing: EASE_OUT })
  }, [full, rail, still, width])

  // The tray keeps its width and the frame closes over it, so nothing reflows on every frame.
  const frame = useAnimatedStyle(() => ({ width: width.value }))
  const fade = still ? {} : { entering: SUBS_IN, exiting: SUBS_OUT }

  function go(id: string): void {
    setHeld(id)
    onNavigate?.(id)
  }

  const row = (link: SidebarLink): ReactNode => {
    const expanded = open.includes(link.id)
    const item = (
      <NavItem
        label={link.label}
        icon={link.icon}
        count={link.count}
        active={current === link.id}
        disabled={link.disabled ?? false}
        chevron={Boolean(link.items)}
        open={expanded}
        rail={rail}
        animated={animated}
        onPress={() => {
          if (link.items) setOpen(expanded ? open.filter((id) => id !== link.id) : [...open, link.id])
          else go(link.id)
        }}
      />
    )
    return (
      <View key={link.id}>
        {rail ? <Tooltip content={link.label} side="right" animated={animated}>{item}</Tooltip> : item}
        {link.items && expanded && !rail ? (
          <Animated.View {...fade} style={styles.subs}>
            {link.items.map((subItem) => <NavItem key={subItem.id} kind="sub" label={subItem.label} count={subItem.count} active={current === subItem.id} disabled={subItem.disabled ?? false} animated={animated} onPress={() => go(subItem.id)} />)}
          </Animated.View>
        ) : null}
      </View>
    )
  }

  const inSections = sections.some((section) => holds(section.links, current))

  return (
    <Animated.View accessibilityLabel={label} style={[styles.frame, frame, style]}>
      <View style={[styles.sidebar, mode === 'drawer' ? styles.sidebarDrawer : null, rail && styles.sidebarRail]}>
        {header ? <View style={[styles.header, rail && styles.centered]}>{header}</View> : null}
        {search && !rail ? <View style={styles.search}>{search}</View> : null}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <GlideList showing={inSections} still={still}>
            <View style={styles.sections}>
              {sections.map((section, i) => (
                <View key={section.label ?? i}>
                  {section.label && !rail ? <Text style={styles.sectionLabel}>{section.label}</Text> : null}
                  <View style={styles.list}>{section.links.map(row)}</View>
                </View>
              ))}
            </View>
          </GlideList>
        </ScrollView>
        {promo && !rail ? <View style={styles.promo}>{promo}</View> : null}
        {bottomLinks.length ? <GlideList showing={!inSections && holds(bottomLinks, current)} still={still}><View style={styles.list}>{bottomLinks.map(row)}</View></GlideList> : null}
        {footer ? <View style={[styles.footer, rail && styles.centered]}>{footer}</View> : null}
      </View>
    </Animated.View>
  )
}

/** A person's row for the Sidebar footer or header. */
export function SidebarPerson({ avatar, name, detail, rail = false }: { avatar: ReactNode; name: string; detail?: string; rail?: boolean }) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.person}>
      {avatar}
      {rail ? null : (
        <View style={styles.personText}>
          <Text numberOfLines={1} style={styles.personName}>{name}</Text>
          {detail ? <Text numberOfLines={1} style={styles.personDetail}>{detail}</Text> : null}
        </View>
      )}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  frame: { borderRadius: radius.tray, flexShrink: 0, height: '100%', overflow: 'hidden' },
  sidebar: { backgroundColor: c.ink4, borderRadius: radius.tray, flex: 1, gap: space[2], minHeight: 0, paddingBottom: space[2], paddingHorizontal: space[2], paddingTop: space[2.5], width: WIDTH.rail },
  sidebarDrawer: { width: WIDTH.drawer },
  sidebarRail: { paddingRight: RAIL_CLIP + space[2] },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 36, paddingHorizontal: space[1] },
  centered: { justifyContent: 'center', paddingHorizontal: 0 },
  search: { paddingHorizontal: space[0.5] },
  scroll: { flex: 1, minHeight: 0 },
  sections: { gap: space[3] },
  sectionLabel: { ...type(10, c.textTertiary, '400', true), paddingHorizontal: space[2.5], paddingVertical: space[1] },
  list: { gap: space[0.5] },
  glideHost: { position: 'relative' },
  subs: { borderLeftColor: c.ink10, borderLeftWidth: 1, gap: space[0.5], marginLeft: space[4.5], marginTop: space[0.5], paddingLeft: space[2] },
  subMark: { backgroundColor: c.textPrimary, bottom: 0, left: -11, position: 'absolute', top: 0, width: 1 },
  surface: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.xl, borderWidth: 1, left: 0, position: 'absolute', top: 0 },
  surfaceFill: { bottom: 0, right: 0 },
  item: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: space[2.5], minHeight: 44, padding: space[3] },
  itemRail: { alignSelf: 'center', height: 44, justifyContent: 'center', padding: 0, width: 44 },
  trigger: { borderRadius: radius.full, gap: space[1], minHeight: 44, paddingLeft: space[3], paddingRight: space[2.5], paddingVertical: 0 },
  triggerOpen: { backgroundColor: c.ink5 },
  triggerWrap: { alignSelf: 'flex-start' },
  off: { opacity: 0.4 },
  label: { ...type(14, c.textPrimary), flex: 1, lineHeight: 20, minWidth: 0 },
  labelActive: { fontWeight: '500' },
  labelSub: { color: c.textSecondary },
  labelTrigger: { flex: 0 },
  count: { ...type(12, c.textSecondary, '400', true) },
  countRail: { ...type(10, c.textInverse, '400', true), backgroundColor: c.inverse, borderRadius: radius.full, lineHeight: 14, minWidth: 14, overflow: 'hidden', paddingHorizontal: space[1], position: 'absolute', right: 2, textAlign: 'center', top: 2 },
  promo: { paddingHorizontal: space[0.5] },
  footer: { padding: space[1] },
  person: { alignItems: 'center', flexDirection: 'row', gap: space[2.5], minWidth: 0 },
  personText: { flexShrink: 1, minWidth: 0 },
  personName: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  personDetail: { ...type(12, c.textSecondary), lineHeight: 16 },
})
