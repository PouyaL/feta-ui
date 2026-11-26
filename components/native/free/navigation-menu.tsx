import { useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewInstance, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated'
import { font, radius, softElevation, space, useColors, type Colors } from '../kit'
import { withInk, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { MenuTurn } from './dropdown-menu'
import { IconButton } from './icon-button'
import { Copy, EASE_OUT, Floating, Mark, Tap, openLink, useCompact, type FloatingMotion } from './popover'
import { NavItem } from './sidebar'

const PANEL_MS = 200
const GAP = 6
const DEFAULT_WIDTH = 480

const MOTION: FloatingMotion = { from: { opacity: 0, scale: 0.98, shift: 4 }, open: { duration: PANEL_MS, easing: EASE_OUT }, close: { duration: 120 } }
const CONTENT_IN = FadeIn.duration(PANEL_MS).easing(EASE_OUT)
const ACCORDION_IN = FadeInUp.duration(PANEL_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: -4 }] })
const SHEET_IN = FadeInUp.duration(PANEL_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: -6 }] })
const SHEET_OUT = FadeOut.duration(120)

export type NavigationLink = { title: string; description?: string; href: string; icon?: ReactNode }

export type NavigationEntry = {
  label: string
  href?: string
  /** Width of the panel on tablets. Default 480. */
  width?: number
  /** A tile beside the links, like a feature. */
  feature?: ReactNode
  /** Mono heading over the grid, like `COMPONENTS`. */
  heading?: ReactNode
  links?: NavigationLink[]
  /** Columns of links on tablets. Default 1. */
  columns?: 1 | 2
  /** A row under the panel, like a version and a changelog link. */
  footer?: ReactNode
}

export type NavigationMenuProps = {
  items: NavigationEntry[]
  /** Logo at the start of the bar. */
  brand?: ReactNode
  /** The end of the bar, like Sign in. On a phone it sits in the menu's footer. */
  end?: ReactNode
  /** A search field. Before `end` on tablets, and across the top of the menu on a phone. */
  search?: ReactNode
  /** A short note in the phone menu's footer, like a version. */
  meta?: ReactNode
  /** Opens the phone menu on mount. `defaultOpen` opens it too. */
  defaultExpanded?: boolean
  /** Draws the menu and close icons of the phone menu's toggle. */
  renderIcon?: RenderIcon
  /** Takes every link press. Without it, http, https and mailto links open through the system. */
  onNavigate?: (href: string) => void
  'aria-label'?: string
  /** Opens this entry on mount. */
  defaultOpen?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Panel({ item, stacked, onNavigate }: { item: NavigationEntry; stacked: boolean; onNavigate: (href: string) => void }) {
  const styles = useThemed(createStyles)
  const pair = !stacked && item.columns === 2
  return (
    <>
      <View style={[styles.content, stacked && styles.contentStacked]}>
        {item.feature ? <View style={stacked ? null : styles.feature}>{item.feature}</View> : null}
        <View style={styles.linksWrap}>
          {item.heading ? <Copy style={styles.heading}>{item.heading}</Copy> : null}
          <View style={[styles.links, pair && styles.linksPair]}>
            {item.links?.map((link) => (
              <Pressable key={link.href} accessibilityRole="link" accessibilityLabel={link.title} accessibilityHint={link.description} onPress={() => onNavigate(link.href)} style={[styles.link, pair && styles.linkPair]}>
                {link.icon ? <View style={styles.linkIcon}>{link.icon}</View> : null}
                <View style={styles.linkBody}>
                  <Text style={styles.linkTitle}>{link.title}</Text>
                  {link.description ? <Text style={styles.linkText}>{link.description}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      {item.footer ? <View style={styles.panelFooter}>{item.footer}</View> : null}
    </>
  )
}

/** A tray pill of triggers. Phones open each entry in place like an accordion; tablets float a panel under the trigger. */
export function NavigationMenu({ items, brand, end, search, meta, defaultExpanded = false, renderIcon, onNavigate, 'aria-label': label = 'Main', defaultOpen, animated = true, style }: NavigationMenuProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const compact = useCompact()
  const colors = useColors()
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null)
  /** The phone menu under the top bar. */
  const [sheet, setSheet] = useState(defaultExpanded || defaultOpen !== undefined)
  const anchor = useRef<ViewInstance | null>(null)
  const nodes = useRef<Record<string, ViewInstance | null>>({})
  const last = useRef<NavigationEntry | undefined>(undefined)
  const current = items.find((item) => item.label === open)
  if (current) last.current = current
  const panel = last.current

  const follow = (href: string): void => {
    if (onNavigate) onNavigate(href)
    else openLink(href)
  }

  function toggle(name: string): void {
    anchor.current = nodes.current[name] ?? null
    setOpen(open === name ? null : name)
  }

  if (compact) {
    // Phones (Figma Navigation Examples, Mobile Menu): the brand and a menu toggle, then a 4% tray holding search, a
    // surface card of 46 rows that open in place, and a footer with the meta and the end.
    const toggleIcon = renderIcon
      ? withInk(renderIcon(sheet ? 'x' : 'menu-01', 20), colors.textPrimary)
      : sheet ? <Mark name="x" size={20} color={colors.textPrimary} /> : <View style={styles.burger}>{[0, 1, 2].map((i) => <View key={i} style={styles.burgerLine} />)}</View>
    return (
      <View accessibilityLabel={label} style={[styles.rootFull, style]}>
        <View style={styles.topBar}>
          {brand ? <View style={styles.brand}>{brand}</View> : <View />}
          <IconButton style={SELF.center} variant="secondary" size="md" animated={animated} label={sheet ? 'Close menu' : 'Open menu'} aria-expanded={sheet} icon={toggleIcon} onPress={() => { if (sheet) setOpen(null); setSheet(!sheet) }} />
        </View>
        {sheet ? (
          <Animated.View {...(still ? {} : { entering: SHEET_IN, exiting: SHEET_OUT })} style={styles.sheet}>
            {search ? <View style={styles.sheetSearch}>{search}</View> : null}
            <View style={styles.sheetCard}>
              {items.map((item) => {
                const isOpen = open === item.label
                return (
                  <View key={item.label}>
                    <Tap
                      accessibilityRole={item.links ? 'button' : 'link'}
                      accessibilityLabel={item.label}
                      {...(item.links ? { 'aria-expanded': isOpen } : {})}
                      animated={animated}
                      onPress={() => { if (item.links) setOpen(isOpen ? null : item.label); else if (item.href) follow(item.href) }}
                      style={[styles.section, isOpen && styles.sectionOpen]}
                    >
                      <Text numberOfLines={1} style={styles.sectionLabel}>{item.label}</Text>
                      {item.links ? <MenuTurn open={isOpen} still={still} color={colors.textSecondary} /> : null}
                    </Tap>
                    {item.links && isOpen ? (
                      <Animated.View {...(still ? {} : { entering: ACCORDION_IN })} style={styles.accordion}>
                        <Panel item={item} stacked onNavigate={follow} />
                      </Animated.View>
                    ) : null}
                  </View>
                )
              })}
            </View>
            {meta || end ? (
              <View style={styles.sheetFooter}>
                {meta ? <Copy style={styles.meta}>{meta}</Copy> : <View />}
                {end ? <View style={styles.end}>{end}</View> : null}
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    )
  }

  const tray = (
    <View style={styles.tray}>
      {items.map((item) => (
        <View
          key={item.label}
          ref={(node) => {
            nodes.current[item.label] = node
            if (item.label === defaultOpen && !anchor.current) anchor.current = node
          }}
          collapsable={false}
        >
          {item.links
            ? <NavItem kind="trigger" label={item.label} chevron open={open === item.label} animated={animated} onPress={() => toggle(item.label)} />
            : <NavItem kind="trigger" label={item.label} animated={animated} onPress={() => { if (item.href) follow(item.href) }} />}
        </View>
      ))}
    </View>
  )

  return (
    <View accessibilityLabel={label} style={[styles.root, style]}>
      <View style={styles.bar}>
        {brand ? <View style={styles.brand}>{brand}</View> : null}
        {tray}
        {search || end ? <View style={styles.end}>{search}{end}</View> : null}
      </View>
      <Floating anchor={anchor} anchorKey={open ?? undefined} open={current !== undefined} side="bottom" align="start" offset={GAP} width={panel?.width ?? DEFAULT_WIDTH} motion={MOTION} animated={animated} onDismiss={() => setOpen(null)}>
        {() => (
          <View style={styles.viewport}>
            {panel ? <Animated.View key={panel.label} {...(still ? {} : { entering: CONTENT_IN })}><Panel item={panel} stacked={false} onNavigate={follow} /></Animated.View> : null}
          </View>
        )}
      </Floating>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  root: { alignSelf: 'flex-start', maxWidth: '100%' },
  rootFull: { alignSelf: 'stretch' },
  bar: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.full, flexDirection: 'row', flexWrap: 'wrap', gap: space[2], maxWidth: '100%', padding: space[1] },
  brand: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: space[2] },
  end: { alignItems: 'center', flexDirection: 'row', gap: space[2], marginLeft: 'auto' },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: space[0.5], maxWidth: '100%' },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[3], paddingHorizontal: space[1] },
  burger: { gap: 4, width: 16 },
  burgerLine: { backgroundColor: c.textPrimary, borderRadius: 1, height: 1.5 },
  sheet: { backgroundColor: c.ink4, borderRadius: radius.frame, padding: space[1] },
  sheetSearch: { paddingBottom: space[2], paddingHorizontal: space[0.5], paddingTop: space[0.5] },
  sheetCard: { boxShadow: softElevation(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, gap: space[0.5], padding: space[1.5] },
  section: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row', gap: space[2], minHeight: 46, paddingLeft: space[3.5], paddingRight: space[3] },
  sectionOpen: { backgroundColor: c.ink5 },
  sectionLabel: { ...type(16, c.textPrimary), flex: 1, lineHeight: 22 },
  sheetFooter: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[1.5], paddingLeft: space[3], paddingRight: space[1.5], paddingTop: space[2.5] },
  meta: { color: c.textTertiary, fontFamily: font.mono, fontSize: 10, lineHeight: 14 },
  viewport: { boxShadow: softElevation(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', padding: space[1.5] },
  content: { flexDirection: 'row', gap: space[1.5] },
  contentStacked: { flexDirection: 'column' },
  feature: { flexBasis: '40%', flexGrow: 0, flexShrink: 0, minWidth: 0 },
  linksWrap: { flex: 1, minWidth: 0 },
  heading: { color: c.textTertiary, fontFamily: font.mono, fontSize: 10, lineHeight: 14, paddingHorizontal: space[2.5], paddingVertical: space[1.5] },
  links: { gap: space[0.5] },
  linksPair: { flexDirection: 'row', flexWrap: 'wrap' },
  link: { borderRadius: radius.xl, flexDirection: 'row', gap: space[2.5], minHeight: 44, paddingHorizontal: space[2.5], paddingVertical: space[2] },
  linkPair: { width: '49%' },
  linkIcon: { flexShrink: 0, paddingTop: space[0.5] },
  linkBody: { flexShrink: 1, minWidth: 0 },
  linkTitle: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  linkText: { ...type(12, c.textSecondary), lineHeight: 16 },
  panelFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: space[1.5], paddingBottom: space[1], paddingHorizontal: space[2.5], paddingTop: space[2] },
  accordion: { paddingVertical: space[1], width: '100%' },
})
