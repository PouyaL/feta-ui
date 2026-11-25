import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, Vibration, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInLeft, FadeInRight, FadeInUp, FadeOutLeft, FadeOutRight, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { pressedState, radius, space, useColors, type Colors } from '../kit'
import { Avatar, type AvatarBadgeType } from './avatar'
import { type, useStill, useThemed } from './card'
import { Menu, MenuTurn, useMenuStore, type MenuEntry } from './dropdown-menu'
import { IconButton } from './icon-button'
import { EASE_OUT, Floating, Mark, soft, Tap, useCompact, type FloatingMotion } from './popover'
import { ToggleGroup } from './toggle-group'

const HOLD_MS = 1200
const DRAIN_MS = 300
const PANEL_MS = 240
const PANEL_X = 24
const HAPTIC_MS = 12
const GAP = 6
const WIDTH = { phone: 358, tablet: 280 }

const MOTION: FloatingMotion = { from: { opacity: 0, scale: 0.96, shift: 4 }, open: { duration: 180, easing: EASE_OUT }, close: { duration: 120 } }
const MAIN_IN = FadeInLeft.duration(PANEL_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: -PANEL_X }] })
const MAIN_OUT = FadeOutLeft.duration(PANEL_MS).easing(EASE_OUT)
const SWITCH_IN = FadeInRight.duration(PANEL_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: PANEL_X }] })
const SWITCH_OUT = FadeOutRight.duration(PANEL_MS).easing(EASE_OUT)
const NOTE_IN = FadeInUp.duration(PANEL_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: -4 }] })

export type ProfileAccount = { id: string; name: string; email: string; initials: string }
export type ProfileStatus = 'online' | 'away' | 'dnd'
export type ProfileTheme = 'light' | 'dark' | 'system'

export type ProfileDropdownProps = {
  account: ProfileAccount
  /** Everyone else this person can switch to. */
  accounts?: ProfileAccount[]
  plan?: string
  status?: ProfileStatus
  defaultStatus?: ProfileStatus
  onStatusChange?: (status: ProfileStatus) => void
  theme?: ProfileTheme
  defaultTheme?: ProfileTheme
  onThemeChange?: (theme: ProfileTheme) => void
  /** The note under the status while it is `dnd`. */
  pausedNote?: string
  /** The app's fetaUI icons for the theme switch and the rows. */
  icons?: Partial<Record<'light' | 'dark' | 'system' | 'profile' | 'settings' | 'billing' | 'switch', ReactNode>>
  onSwitchAccount?: (account: ProfileAccount) => void
  onAddAccount?: () => void
  onProfile?: () => void
  onSettings?: () => void
  onBilling?: () => void
  /** Fires when the 1.2 s hold completes. Screen readers get a plain Sign out action. */
  onSignOut?: () => void
  defaultOpen?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const BADGE: Record<ProfileStatus, AvatarBadgeType> = { online: 'online', away: 'away', dnd: 'busy' }

/** Hold to confirm. The fill says how long is left, so it still moves with reduced motion. */
function HoldToSignOut({ onDone, still }: { onDone: () => void; still: boolean }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const progress = useSharedValue(0)
  const width = useSharedValue(0)
  const done = useRef(false)
  const [holding, setHolding] = useState(false)

  useEffect(() => () => cancelAnimation(progress), [progress])

  function finish(): void {
    done.current = true
    Vibration.vibrate(HAPTIC_MS)
    setHolding(false)
    onDone()
  }

  function start(): void {
    done.current = false
    setHolding(true)
    progress.value = withTiming(1, { duration: HOLD_MS * (1 - progress.value), easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(finish)()
    })
  }

  function release(): void {
    if (done.current) return
    setHolding(false)
    progress.value = withTiming(0, { duration: still ? 0 : DRAIN_MS, easing: EASE_OUT })
  }

  const fill = useAnimatedStyle(() => ({ width: progress.value * width.value }))
  const inner = useAnimatedStyle(() => ({ width: width.value }))
  const hint = holding ? 'Keep holding' : 'Hold'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      accessibilityHint="Press and hold"
      accessibilityActions={[{ name: 'activate', label: 'Sign out' }]}
      onAccessibilityAction={finish}
      onLayout={(e: LayoutChangeEvent) => { width.value = e.nativeEvent.layout.width }}
      onPressIn={start}
      onPressOut={release}
      style={styles.signOut}
    >
      {holding ? <View style={styles.signOutWash} /> : null}
      <View style={styles.signOutRow}>
        <Mark name="chevron-right" color={holding ? colors.danger : colors.textPrimary} />
        <Text style={[styles.signOutLabel, holding && styles.signOutDanger]}>Sign out</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.hint, holding && styles.signOutDanger]}>{hint}</Text>
      </View>
      {/* The solid fill repeats the row in the on-solid color, so text turns as the edge passes it. */}
      <Animated.View aria-hidden pointerEvents="none" style={[styles.fill, fill]}>
        <Animated.View style={[styles.signOutRow, inner]}>
          <Mark name="chevron-right" color={colors.textInverse} />
          <Text style={[styles.signOutLabel, styles.signOutSolid]}>Sign out</Text>
          <Text style={[styles.hint, styles.signOutSolid]}>{hint}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

/** The account menu behind your avatar, with status, theme and a hold to sign out. */
export function ProfileDropdown({ account, accounts = [], plan = 'Pro', status, defaultStatus = 'online', onStatusChange, theme, defaultTheme = 'system', onThemeChange, pausedNote = 'Notifications paused until 9:00 AM', icons = {}, onSwitchAccount, onAddAccount, onProfile, onSettings, onBilling, onSignOut, defaultOpen = false, animated = true, style }: ProfileDropdownProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const compact = useCompact()
  const anchor = useRef<ComponentRef<typeof View>>(null)
  const switching = useRef(false)
  const store = useMenuStore()
  const [open, setOpen] = useState(defaultOpen)
  const [panel, setPanel] = useState<'main' | 'switch'>('main')
  const [heldStatus, setHeldStatus] = useState(defaultStatus)
  const [heldTheme, setHeldTheme] = useState(defaultTheme)
  const currentStatus = status ?? heldStatus
  const currentTheme = theme ?? heldTheme
  const shut = (): void => { setOpen(false); setPanel('main') }

  // The row's flash timer dies with the main panel, so the flag is cleared on the way back.
  useEffect(() => { if (panel === 'main') switching.current = false }, [panel])

  const entries: MenuEntry[] = [
    { label: 'Profile', icon: icons.profile, ...(onProfile ? { onSelect: onProfile } : {}) },
    { label: 'Settings', icon: icons.settings, shortcut: ['⌘', ','], ...(onSettings ? { onSelect: onSettings } : {}) },
    { label: 'Billing', icon: icons.billing, ...(onBilling ? { onSelect: onBilling } : {}) },
    { id: 'switch', label: 'Switch account', icon: icons.switch, chevron: true, onSelect: () => { switching.current = true; setPanel('switch') } },
  ]

  const avatar = (who: ProfileAccount, size: 'sm' | 'md', badge?: AvatarBadgeType): ReactNode => (
    <Avatar initials={who.initials} size={size} animated={animated} {...(badge ? { badge, badgeLabel: currentStatus } : {})} />
  )
  const who = (person: ProfileAccount): ReactNode => (
    <View style={styles.who}>
      <Text numberOfLines={1} style={styles.name}>{person.name}</Text>
      <Text numberOfLines={1} style={styles.email}>{person.email}</Text>
    </View>
  )

  return (
    <View ref={anchor} collapsable={false} style={[compact ? styles.rootPhone : styles.rootTablet, style]}>
      <Tap accessibilityLabel={`${account.name}, account menu`} aria-expanded={open} animated={animated} onPress={() => { if (open) shut(); else setOpen(true) }} style={[styles.trigger, open && styles.triggerOpen]}>
        {avatar(account, 'sm', BADGE[currentStatus])}
        {who(account)}
        <MenuTurn open={open} still={still} color={colors.textSecondary} />
      </Tap>
      <Floating anchor={anchor} open={open} side="bottom" align="start" offset={GAP} width={compact ? WIDTH.phone : WIDTH.tablet} motion={MOTION} animated={animated} onDismiss={() => { if (panel === 'switch') setPanel('main'); else shut() }}>
        {() => (
          <View style={styles.pop}>
            {panel === 'main' ? (
              <Animated.View key="main" {...(still ? {} : { entering: MAIN_IN, exiting: MAIN_OUT })} style={styles.panel}>
                <View style={styles.block}>
                  <View style={styles.card}>
                    {avatar(account, 'md', BADGE[currentStatus])}
                    {who(account)}
                    <Text style={styles.plan}>{plan}</Text>
                  </View>
                  <View style={styles.setting}>
                    <Text style={styles.settingName}>Status</Text>
                    <ToggleGroup
                      type="single"
                      label="Status"
                      animated={animated}
                      value={currentStatus}
                      items={[{ value: 'online', label: 'Online' }, { value: 'away', label: 'Away' }, { value: 'dnd', label: 'DND' }]}
                      onValueChange={(next) => { setHeldStatus(next as ProfileStatus); onStatusChange?.(next as ProfileStatus) }}
                    />
                  </View>
                  <View style={styles.setting}>
                    <Text style={styles.settingName}>Theme</Text>
                    <ToggleGroup
                      type="single"
                      label="Theme"
                      animated={animated}
                      value={currentTheme}
                      items={[{ value: 'light', ...(icons.light ? { icon: icons.light, ariaLabel: 'Light' } : { label: 'Light' }) }, { value: 'dark', ...(icons.dark ? { icon: icons.dark, ariaLabel: 'Dark' } : { label: 'Dark' }) }, { value: 'system', ...(icons.system ? { icon: icons.system, ariaLabel: 'System' } : { label: 'System' }) }]}
                      onValueChange={(next) => { setHeldTheme(next as ProfileTheme); onThemeChange?.(next as ProfileTheme) }}
                    />
                  </View>
                  {currentStatus === 'dnd' ? <Animated.Text {...(still ? {} : { entering: NOTE_IN })} style={styles.note}>{pausedNote}</Animated.Text> : null}
                </View>
                <Menu
                  style={styles.rows}
                  entries={entries}
                  label={account.name}
                  store={store}
                  still={still}
                  onClose={() => {
                    // Switch account keeps the menu open.
                    if (switching.current) { switching.current = false; return }
                    shut()
                  }}
                />
                <HoldToSignOut still={still} onDone={() => { shut(); onSignOut?.() }} />
              </Animated.View>
            ) : (
              <Animated.View key="switch" {...(still ? {} : { entering: SWITCH_IN, exiting: SWITCH_OUT })} style={styles.panel}>
                <View style={styles.head}>
                  <IconButton variant="ghost" size="sm" label="Back" icon={<Mark name="chevron-left" />} animated={animated} onPress={() => setPanel('main')} />
                  <Text style={styles.headTitle}>Switch account</Text>
                </View>
                <View accessibilityLabel="Accounts" style={styles.accounts}>
                  {[account, ...accounts].map((person) => (
                    <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={person.name} {...pressedState(person.id === account.id)} onPress={() => { if (person.id !== account.id) onSwitchAccount?.(person); shut() }} style={styles.accountRow}>
                      {avatar(person, 'sm')}
                      {who(person)}
                      {person.id === account.id ? <Mark name="tick" /> : null}
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel="Add account" onPress={() => { onAddAccount?.(); shut() }} style={styles.accountRow}>
                    <View style={styles.addIcon}><Mark name="plus" color={colors.textSecondary} /></View>
                    <Text style={styles.name}>Add account</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </View>
        )}
      </Floating>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  rootPhone: { alignSelf: 'stretch', maxWidth: '100%' },
  rootTablet: { alignSelf: 'flex-start', maxWidth: '100%', width: 260 },
  trigger: { alignItems: 'center', backgroundColor: c.ink4, borderColor: 'transparent', borderRadius: radius.card, borderWidth: 1.5, flexDirection: 'row', gap: space[2.5], minHeight: 44, paddingLeft: space[1.5], paddingRight: space[2.5], paddingVertical: space[1.5] },
  triggerOpen: { borderColor: c.textPrimary },
  who: { flex: 1, minWidth: 0 },
  name: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  email: { ...type(12, c.textSecondary), lineHeight: 16 },
  pop: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.tray, borderWidth: 1, overflow: 'hidden', padding: space[1.5] },
  panel: { gap: space[1.5] },
  block: { backgroundColor: c.ink4, borderRadius: radius['2xl'], gap: space[2], padding: space[3] },
  card: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  plan: { ...type(11, c.textInverse, '500'), backgroundColor: c.inverse, borderRadius: radius.full, flexShrink: 0, lineHeight: 14, overflow: 'hidden', paddingHorizontal: space[2], paddingVertical: space[0.5] },
  setting: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  settingName: { ...type(12, c.textSecondary), lineHeight: 16 },
  note: { ...type(12, c.textSecondary), backgroundColor: c.surface, borderRadius: radius.xl, lineHeight: 16, overflow: 'hidden', paddingHorizontal: space[2.5], paddingVertical: space[2] },
  rows: { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, padding: 0, shadowOpacity: 0 },
  signOut: { borderRadius: radius.xl, height: 44, overflow: 'hidden' },
  signOutWash: { ...StyleSheet.absoluteFill, backgroundColor: c.danger, opacity: 0.15 },
  signOutRow: { alignItems: 'center', flexDirection: 'row', gap: space[2.5], height: 44, paddingHorizontal: space[2.5] },
  signOutLabel: { ...type(14, c.textPrimary), flex: 1, lineHeight: 20 },
  signOutDanger: { color: c.danger },
  signOutSolid: { color: c.textInverse },
  hint: { ...type(12, c.textTertiary), lineHeight: 16 },
  fill: { backgroundColor: c.danger, bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], padding: space[0.5] },
  headTitle: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  accounts: { gap: space[0.5] },
  accountRow: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: space[2.5], minHeight: 44, paddingHorizontal: space[2], paddingVertical: space[1.5] },
  addIcon: { alignItems: 'center', justifyContent: 'center', width: 28 },
})
