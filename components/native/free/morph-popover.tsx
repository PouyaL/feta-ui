import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Button, ICON_SIZE, withInk, type Spring, SELF } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { IconButton } from './icon-button'

/** Motion's `duration: 0.42, bounce: 0.14`, as stiffness and damping. */
const MORPH: Spring = { stiffness: 224, damping: 26, mass: 1 }
const GROW = LinearTransition.springify().stiffness(MORPH.stiffness).damping(MORPH.damping).mass(MORPH.mass)
const BODY_IN = FadeIn.duration(200).delay(80)
const SWAP_IN = FadeIn.duration(200)
const SWAP_OUT = FadeOut.duration(120)
const PILL_RADIUS = 18
const TRAY_RADIUS = radius.tray

export type MorphPopoverProps = {
  label?: string
  placeholder?: string
  /** Sends the note. The form shows a loader until the promise settles. */
  onSend?: (text: string) => Promise<void> | void
  disabled?: boolean
  /** `false` swaps pill and form without the morph. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
  icon?: ReactNode
  /** Draws `chat-feedback`, `x` and `tick-02`. */
  renderIcon: RenderIcon
}

type State = 'idle' | 'open' | 'sending' | 'sent'

/** A feedback pill that grows into its own form. */
export function MorphPopover({ label = 'Feedback', placeholder = 'What would make this better?', onSend, disabled, animated = true, style, icon, renderIcon }: MorphPopoverProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [state, setState] = useState<State>('idle')
  const [text, setText] = useState('')
  const open = state !== 'idle'
  const off = Boolean(disabled)
  const corner = useSharedValue(PILL_RADIUS)
  const cornerStyle = useAnimatedStyle(() => ({ borderRadius: corner.value }))
  const glyph = withInk(icon ?? renderIcon('chat-feedback', ICON_SIZE), off ? colors.textQuaternary : colors.textPrimary)

  useEffect(() => {
    const target = open ? TRAY_RADIUS : PILL_RADIUS
    corner.value = still ? target : withSpring(target, MORPH)
  }, [open, still, corner])

  function close(): void {
    setState('idle')
    setText('')
  }

  async function send(): Promise<void> {
    if (!text.trim() || state !== 'open') return
    setState('sending')
    try {
      await onSend?.(text)
      setState('sent')
    } catch {
      setState('open')
    }
  }

  return (
    <View style={[styles.anchor, style]}>
      <Animated.View {...(still ? {} : { layout: GROW })} role={open ? 'dialog' : undefined} accessibilityLabel={open ? label : undefined} style={[open ? styles.tray : styles.pill, off && styles.pillOff, cornerStyle]}>
        {open ? (
          <>
            <View style={styles.header}>
              <View style={styles.title}>
                {glyph}
                <Text numberOfLines={1} style={styles.titleText}>{label}</Text>
              </View>
              <IconButton style={SELF.center} variant="ghost" size="sm" label="Close" animated={animated} icon={renderIcon('x', ICON_SIZE)} onPress={close} />
            </View>
            <Animated.View {...(still ? {} : { entering: BODY_IN })} style={styles.body}>
              <LayoutAnimationConfig skipEntering>
                {state === 'sent' ? (
                  <Animated.View key="sent" accessibilityLiveRegion="polite" {...(still ? {} : { entering: SWAP_IN })} style={styles.sent}>
                    <View style={styles.badge}>{withInk(renderIcon('tick-02', 16), colors.textInverse)}</View>
                    <Text style={styles.sentTitle}>Thanks for the feedback</Text>
                    <Text style={styles.meta}>We read every note.</Text>
                  </Animated.View>
                ) : (
                  <Animated.View key="form" {...(still ? {} : { exiting: SWAP_OUT })}>
                    <TextInput
                      autoFocus
                      multiline
                      accessibilityLabel={placeholder}
                      placeholder={placeholder}
                      placeholderTextColor={colors.textTertiary}
                      value={text}
                      editable={state !== 'sending'}
                      textAlignVertical="top"
                      style={styles.field}
                      onChangeText={setText}
                    />
                    <View style={styles.footer}>
                      <Button style={SELF.end} size="sm" shape="pill" animated={animated} disabled={!text.trim()} status={state === 'sending' ? 'loading' : 'idle'} loadingLabel="Sending" onPress={() => void send()}>Send</Button>
                    </View>
                  </Animated.View>
                )}
              </LayoutAnimationConfig>
            </Animated.View>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            aria-disabled={off}
            aria-expanded={false}
            disabled={off}
            style={({ pressed }) => [styles.pillContent, pressed && styles.pillPressed]}
            onPress={() => setState('open')}
          >
            {glyph}
            <Text numberOfLines={1} style={[styles.titleText, off && styles.textOff]}>{label}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  anchor: { alignItems: 'flex-start', alignSelf: 'stretch' },
  pill: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1, height: 44, overflow: 'hidden' },
  pillOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  pillContent: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[2], paddingHorizontal: space[3.5] },
  pillPressed: { backgroundColor: c.ink5 },
  tray: { backgroundColor: c.muted, maxWidth: 340, overflow: 'hidden', padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: space[2.5], paddingLeft: space[3], paddingRight: space[2], paddingTop: space[2] },
  title: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[2] },
  titleText: type(16, c.textPrimary, '500'),
  textOff: { color: c.textQuaternary },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  field: { color: c.textPrimary, fontFamily: font.sans, fontSize: 16, height: 112, letterSpacing: font.tracking(16), paddingHorizontal: space[4], paddingVertical: space[3.5] },
  footer: { alignItems: 'flex-end', backgroundColor: c.ink4, padding: space[2] },
  sent: { alignItems: 'center', gap: space[2.5], paddingHorizontal: space[4], paddingVertical: space[7] },
  badge: { alignItems: 'center', backgroundColor: c.success, borderRadius: radius.full, height: space[8], justifyContent: 'center', width: space[8] },
  sentTitle: type(14, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
})
