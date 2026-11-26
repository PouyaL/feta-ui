import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, FadeOutDown, ZoomIn } from 'react-native-reanimated'
import { radius, space, useColors, useReduceMotion, type Colors } from '../kit'
import { Button, withInk } from './button'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
/** Consent opens: 240 ms, y 12 to 0. */
const openIn = FadeInDown.duration(240).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 12 }] })
const openOut = FadeOutDown.duration(240).easing(EASE_OUT)
/** Reduced motion keeps a 150 ms fade. */
const FADE_MS = 150
/** The one line form hides itself after 4 s. */
const HIDE_AFTER_MS = 4000

export type ConsentValue = 'asking' | 'accepted' | 'declined'

export type ConsentCardProps = {
  value?: ConsentValue
  defaultValue?: ConsentValue
  onValueChange?: (value: 'accepted' | 'declined') => void
  /** Fires when it closes, by the close button or after `hideAfter`. */
  onDismiss?: () => void
  title?: ReactNode
  description?: ReactNode
  acceptLabel?: string
  declineLabel?: string
  /** One line title after accepting. */
  acceptedTitle?: ReactNode
  /** One line title after declining. */
  declinedTitle?: ReactNode
  /** Under the one line title. */
  note?: ReactNode
  /** Milliseconds before the one line form hides. `0` keeps it. Default 4000. */
  hideAfter?: number
  /** `corner` docks to the bottom of the screen. Default `inline`. */
  placement?: 'inline' | 'corner'
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Asks once whether analytics may run, then folds to a one line confirmation. */
export function ConsentCard({ value, defaultValue = 'asking', onValueChange, onDismiss, title = 'Cookies', description = 'This site uses analytics to see which pages help. Nothing is sold or shared.', acceptLabel = 'Accept', declineLabel = 'Decline', acceptedTitle = 'Analytics on', declinedTitle = 'Analytics off', note = 'Change it any time in Settings', hideAfter = HIDE_AFTER_MS, placement = 'inline', renderIcon, animated = true, style }: ConsentCardProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const reduce = useReduceMotion()
  const [held, setHeld] = useState<ConsentValue>(defaultValue)
  const [closed, setClosed] = useState(false)
  const answer = value ?? held
  const asking = answer === 'asking'

  function choose(next: 'accepted' | 'declined'): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function close(): void {
    setClosed(true)
    onDismiss?.()
  }

  useEffect(() => {
    if (asking || closed || !hideAfter) return undefined
    const timer = setTimeout(close, hideAfter)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking, closed, hideAfter])

  if (closed) return null
  const open = still ? (reduce && animated ? { entering: FadeIn.duration(FADE_MS), exiting: FadeOut.duration(FADE_MS) } : {}) : { entering: openIn, exiting: openOut }
  const closeButton = <IconButton variant="ghost" size="sm" icon={renderIcon('x', 16)} label="Close" animated={animated} onPress={close} />

  return (
    <Animated.View {...open} accessibilityLabel="Consent" style={[placement === 'corner' && styles.corner, style]}>
      {asking ? (
        <Animated.View key="asking" {...(still ? {} : { exiting: FadeOut.duration(180) })}>
          <Card animated={animated} bodyStyle={styles.askBody} footerStyle={styles.actions} footer={<><Button variant="secondary" size="lg" animated={animated} style={styles.action} onPress={() => choose('declined')}>{declineLabel}</Button><Button size="lg" animated={animated} style={styles.action} onPress={() => choose('accepted')}>{acceptLabel}</Button></>}>
            <View style={styles.header}>
              <View style={styles.cookie}>{withInk(renderIcon('cookie', 20), colors.textInverse)}</View>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              {closeButton}
            </View>
            <Text style={styles.description}>{description}</Text>
          </Card>
        </Animated.View>
      ) : (
        <Animated.View key="answered" {...(still ? {} : { entering: ZoomIn.springify().stiffness(420).damping(26).withInitialValues({ transform: [{ scale: 0.98 }] }) })} accessibilityLiveRegion="polite">
          <Card animated={animated} bodyStyle={styles.doneBody}>
            <View style={styles.line}>
              <View style={[styles.mark, answer === 'accepted' && styles.markOn]}>{withInk(renderIcon(answer === 'accepted' ? 'check' : 'x', 14), answer === 'accepted' ? colors.onSolid : colors.textSecondary)}</View>
              <View style={styles.lineText}><Text style={styles.lineTitle}>{answer === 'accepted' ? acceptedTitle : declinedTitle}</Text><Text style={styles.note}>{note}</Text></View>
              {closeButton}
            </View>
          </Card>
        </Animated.View>
      )}
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  corner: { bottom: space[4], left: space[4], position: 'absolute', right: space[4] },
  askBody: { padding: space[5] },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2.5], marginBottom: space[1] },
  cookie: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, height: 32, justifyContent: 'center', width: 32 },
  title: { ...type(14, c.textPrimary, '600'), lineHeight: 20, flex: 1 },
  description: { ...type(16, c.textSecondary), lineHeight: 24 },
  actions: { paddingTop: space[2], paddingHorizontal: space[1], paddingBottom: space[1] },
  action: { flex: 1 },
  doneBody: { paddingVertical: space[3.5], paddingLeft: space[3.5], paddingRight: space[4] },
  line: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  mark: { alignItems: 'center', backgroundColor: c.ink8, borderRadius: radius.full, height: 28, justifyContent: 'center', width: 28 },
  markOn: { backgroundColor: c.success },
  lineText: { flex: 1, gap: space[0.5] },
  lineTitle: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  note: { ...type(12, c.textTertiary), lineHeight: 16 },
})
