import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, FadeOutDown, LayoutAnimationConfig, runOnJS } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Button, withInk, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { COOKIE_CATEGORIES, CookiePreferences, type CookieCategory, type CookieChoices } from './cookie-preferences'
import { EASE_OUT, openLink, useCompact } from './popover'

/** Enter 240 ms, y 16 to 0. Exit 180 ms. Saved crossfades in 200 ms and hides after 4 s. */
const ENTER_MS = 240
const EXIT_MS = 180
const FADE_MS = 200
const RISE = 16
const SAVED_HOLD = 4000
const EASE_IN = Easing.bezierFn(0.4, 0, 1, 1)
const enter = FadeInDown.duration(ENTER_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: RISE }] })
const viewIn = FadeIn.duration(FADE_MS).easing(EASE_OUT)
const viewOut = FadeOut.duration(FADE_MS).easing(EASE_OUT)
/** Lifts the 20 tall link to a 44 target. */
const LINK_SLOP = 12

export type CookieBannerProps = {
  /** The long copy. */
  message?: ReactNode
  /** One line with a policy link. */
  compact?: boolean
  /** The line on `compact`. */
  compactMessage?: ReactNode
  policyHref?: string
  /** Pins it to the bottom of its screen. `false` keeps it in the flow. Default `true`. */
  fixed?: boolean
  categories?: CookieCategory[]
  /** Starts on Saved with these choices. */
  defaultChoices?: CookieChoices
  /** Runs for every answer. Load optional cookies only after this. */
  onChoose?: (choices: CookieChoices) => Promise<void> | void
  /** Milliseconds on Saved before it hides. `0` keeps it. Default 4000. */
  savedHold?: number
  /** Fires once it has left. */
  onHidden?: () => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function summary(choices: CookieChoices, categories: CookieCategory[]): string {
  const on = categories.filter(({ id, locked }) => !locked && choices.includes(id)).map(({ title }) => title)
  const names = ['Essential', ...on]
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are on.` : 'Only essential cookies are on.'
  return `${list} Change this any time in settings.`
}

/** Asks once. Reject all and Accept all carry the same weight, and Customize opens the preferences. */
export function CookieBanner({
  message = 'We use essential cookies to run this app. With your OK, we\'d also use optional ones to remember settings and learn what helps.', compact = false, compactMessage = 'We use cookies.', policyHref = '#', fixed = true,
  categories = COOKIE_CATEGORIES, defaultChoices, onChoose, savedHold = SAVED_HOLD, onHidden, renderIcon, animated = true, style,
}: CookieBannerProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const stacked = useCompact()
  const [shown, setShown] = useState(true)
  const [choices, setChoices] = useState<CookieChoices | null>(defaultChoices ?? null)
  const [preferring, setPreferring] = useState(false)
  const [busy, setBusy] = useState(false)
  // Which answer is being saved, so only that button spins.
  const [pressed, setPressed] = useState<'reject' | 'accept'>('accept')
  const saved = choices !== null
  const optional = categories.filter(({ locked }) => !locked).map((item) => item.id)
  const locked = categories.filter((item) => item.locked).map((item) => item.id)
  const hidden = useRef(onHidden)
  hidden.current = onHidden

  useEffect(() => {
    if (!saved || !savedHold || preferring) return undefined
    const timer = setTimeout(() => setShown(false), savedHold)
    return () => clearTimeout(timer)
  }, [saved, savedHold, preferring])

  useEffect(() => {
    if (!shown && still) hidden.current?.()
  }, [shown, still])

  const leave = useMemo(() => {
    const done = (): void => hidden.current?.()
    return FadeOutDown.duration(EXIT_MS).easing(EASE_IN).withCallback((finished) => {
      'worklet'
      if (finished) runOnJS(done)()
    })
  }, [])

  async function answer(next: CookieChoices): Promise<void> {
    setBusy(true)
    try {
      await onChoose?.(next)
      setChoices(next)
    } finally {
      setBusy(false)
    }
  }

  const size = stacked ? 'md' : 'sm'
  // On a phone Customize spans both columns under Reject all and Accept all, its label centred, as the web grid does.
  const customize = <Button style={stacked ? styles.full : undefined} variant="ghost" size={size} disabled={busy} animated={animated} onPress={() => setPreferring(true)}>Customize</Button>
  const reject = <Button style={stacked ? styles.half : undefined} variant="secondary" shape="pill" size={size} disabled={busy && pressed !== 'reject'} status={busy && pressed === 'reject' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onPress={() => { setPressed('reject'); void answer(locked) }}>Reject all</Button>
  const accept = <Button style={stacked ? styles.half : undefined} variant="secondary" shape="pill" size={size} disabled={busy && pressed !== 'accept'} status={busy && pressed === 'accept' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onPress={() => { setPressed('accept'); void answer([...locked, ...optional]) }}>Accept all</Button>

  return (
    <>
      {shown ? (
        <Animated.View
          {...(still ? {} : { entering: enter, exiting: leave })}
          accessibilityLabel="Cookie consent"
          style={[styles.host, fixed && styles.fixed, style]}
        >
          <LayoutAnimationConfig skipEntering>
            {saved ? (
              <Animated.View key="saved" {...(still ? {} : { entering: viewIn, exiting: viewOut })} accessibilityLiveRegion="polite" style={styles.savedTray}>
                <View style={styles.savedCard}>
                  <View style={styles.tile}>{withInk(renderIcon('check', 14), colors.success)}</View>
                  <View style={styles.savedText}>
                    <Text style={styles.savedTitle}>Choices saved</Text>
                    <Text style={styles.savedDetail}>{summary(choices, categories)}</Text>
                  </View>
                  <Button style={SELF.center} variant="ghost" size="sm" animated={animated} onPress={() => setPreferring(true)}>Change</Button>
                </View>
              </Animated.View>
            ) : (
              <Animated.View key="ask" {...(still ? {} : { entering: viewIn, exiting: viewOut })} style={[styles.tray, !stacked && styles.trayWide]}>
                {stacked ? null : <View style={styles.plate} />}
                <View style={[styles.copy, stacked && styles.copyCard]}>
                  {compact ? (
                    <View style={styles.compactRow}>
                      <Text style={styles.text}>{compactMessage} </Text>
                      <Pressable accessibilityRole="link" accessibilityLabel="Read the policy" hitSlop={LINK_SLOP} onPress={() => openLink(policyHref)}>
                        <Text style={styles.link}>Read the policy</Text>
                      </Pressable>
                    </View>
                  ) : <Text style={styles.text}>{message}</Text>}
                </View>
                {stacked ? (
                  <View style={styles.actionsStacked}>
                    <View style={styles.actions}>{reject}{accept}</View>
                    {customize}
                  </View>
                ) : <View style={styles.actions}>{customize}{reject}{accept}</View>}
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        </Animated.View>
      ) : null}
      <CookiePreferences open={preferring} onOpenChange={setPreferring} categories={categories} defaultValue={(choices ?? []).filter((key) => optional.includes(key))} onSave={answer} renderIcon={renderIcon} animated={animated} />
    </>
  )
}

/** --feta-elevation-soft. */
const softShadow = (c: Colors): string => (c.surface === '#ffffff' ? '0px 1px 2px 0px #0000000a, 0px 6px 20px -10px #0000001f' : '0px 1px 2px 0px #00000080, 0px 6px 20px -10px #00000099')

const createStyles = (c: Colors) => StyleSheet.create({
  host: { maxWidth: 358, width: '100%' },
  fixed: { alignSelf: 'center', bottom: space[4], position: 'absolute', zIndex: 50 },
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, gap: space[1], padding: space[1] },
  trayWide: { alignItems: 'center', flexDirection: 'row', gap: space[4], paddingBottom: space[3.5], paddingLeft: space[5], paddingRight: space[3], paddingTop: space[3.5] },
  plate: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, bottom: space[1], left: space[1], position: 'absolute', right: space[1], top: space[1] },
  copy: { flex: 1, minWidth: 0 },
  copyCard: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, boxShadow: softShadow(c), flex: 0, padding: space[3.5] },
  compactRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  text: { ...type(14, c.textSecondary), lineHeight: 20 },
  link: { ...type(14, c.textPrimary, '500'), marginLeft: space[0.5], textDecorationLine: 'underline' },
  actions: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: space[1.5] },
  actionsStacked: { gap: space[1.5], paddingTop: space[1] },
  half: { flex: 1 },
  full: { alignSelf: 'stretch' },
  savedTray: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1] },
  savedCard: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space[2.5], paddingLeft: space[3], paddingRight: space[2], paddingVertical: space[2.5] },
  tile: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexShrink: 0, height: 28, justifyContent: 'center', width: 28 },
  savedText: { flex: 1, minWidth: 0 },
  savedTitle: type(14, c.textPrimary, '500'),
  savedDetail: type(12, c.textSecondary),
})
