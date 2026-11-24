import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { iconFor } from './label'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'] as const
const MAX_DIGITS = 9
const SHAKE_STOPS = [-10, 9, -6, 4, 0]
const SHAKE_MS = 360
const RESET_MS = 1600
const FAST_MS = 150
const DIGIT = { stiffness: 520, damping: 30, mass: 1 } as const
const PRESS = { stiffness: 600, damping: 32, mass: 1 } as const
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

const digitIn = FadeInDown.springify().stiffness(DIGIT.stiffness).damping(DIGIT.damping).mass(DIGIT.mass).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
const digitMove = LinearTransition.springify().stiffness(DIGIT.stiffness).damping(DIGIT.damping).mass(DIGIT.mass)

type Key = (typeof KEYS)[number]
type Phase = 'idle' | 'sending' | 'sent' | 'failed'

export type AmountPadProps = {
  /** Who receives it. */
  to?: string
  /** One or two letters for the avatar. */
  initials?: string
  currency?: string
  /** The note under the amount. */
  note?: string
  /** Amounts past this shake and disable Send. */
  limit?: number
  presets?: number[]
  /** Resolve to show Sent, reject to show Try again. */
  onSend?: (amount: number) => void | Promise<void>
  disabled?: boolean
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const money = (value: number): string => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

function PadKey({ value, disabled, still, renderIcon, onPress }: { value: Key; disabled: boolean; still: boolean; renderIcon: RenderIcon | undefined; onPress: () => void }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const scale = useSharedValue(1)
  const tap = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      accessibilityLabel={value === 'delete' ? 'Delete' : value === '.' ? 'Decimal point' : value}
      accessibilityRole="button"
      aria-disabled={disabled}
      disabled={disabled}
      style={[styles.key, tap]}
      onPress={onPress}
      onPressIn={() => { if (!still) scale.value = withSpring(0.96, PRESS) }}
      onPressOut={() => { if (!still) scale.value = withSpring(1, PRESS) }}
    >
      {value === 'delete' ? iconFor(renderIcon, 'delete-02', 20, disabled ? colors.ink10 : colors.textPrimary) : <Text style={[styles.keyText, disabled && styles.keyOff]}>{value}</Text>}
    </AnimatedPressable>
  )
}

/** A send money keypad. Digits spring in, commas slide into place, and Send carries the amount. */
export function AmountPad({ to = 'Noa Lindqvist', initials = 'NL', currency = '$', note = 'Balance $4,210.00', limit = 5000, presets = [20, 50, 100], onSend, disabled = false, renderIcon, animated = true, style }: AmountPadProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const x = useSharedValue(0)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const amount = Number(text || 0)
  const over = amount > limit
  const locked = disabled || phase === 'sending' || phase === 'sent'
  const [whole = '', cents] = text.split('.')
  const group = useMemo(() => Number(whole || 0).toLocaleString('en-US'), [whole])
  const chars = text ? [...group, ...(text.includes('.') ? ['.', ...(cents ?? '')] : [])] : ['0']
  const ghost = text.includes('.') ? '00'.slice((cents ?? '').length) : ''
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  useEffect(() => {
    if (phase !== 'sent') return
    const timer = setTimeout(() => { setText(''); setPhase('idle') }, RESET_MS)
    return () => clearTimeout(timer)
  }, [phase])

  function refuse(): void {
    if (still) return
    const leg = { duration: SHAKE_MS / SHAKE_STOPS.length, easing: OUT }
    x.value = withSequence(...SHAKE_STOPS.map((stop) => withTiming(stop, leg)))
  }

  function press(key: Key): void {
    if (locked) return
    if (phase === 'failed') setPhase('idle')
    if (key === 'delete') { setText((t) => t.slice(0, -1)); return }
    if (key === '.' && text.includes('.')) return
    const next = key === '.' && !text ? '0.' : text === '0' && key !== '.' ? key : text + key
    const [, decimals] = next.split('.')
    if ((decimals?.length ?? 0) > 2 || next.replace('.', '').length > MAX_DIGITS) { refuse(); return }
    if (Number(next) > limit && !over) refuse()
    setText(next)
  }

  async function send(): Promise<void> {
    setPhase('sending')
    try {
      await onSend?.(amount)
      setPhase('sent')
    } catch {
      setPhase('failed')
    }
  }

  const message = over ? `The limit is ${currency}${money(limit)}` : phase === 'failed' ? 'That did not go through' : note
  const label = phase === 'sent' ? 'Sent' : phase === 'sending' ? 'Sending' : phase === 'failed' ? 'Try again' : amount ? `Send ${currency}${money(amount)}` : 'Enter an amount'
  const ink = [styles.amount, !text && styles.amountEmpty, over && styles.amountOver]

  return (
    <View accessibilityLabel={`Send money to ${to}`} style={[styles.pad, style]}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.who}>
          <Text style={styles.small}>Send to</Text>
          <Text numberOfLines={1} style={styles.name}>{to}</Text>
        </View>
        <Text style={styles.currency}>USD</Text>
      </View>
      <View style={styles.body}>
        <Animated.View accessible accessibilityLabel={`${currency}${money(amount)}`} style={[styles.chars, shake]}>
          <Text style={ink}>{currency}</Text>
          {chars.map((char, i) => (
            <Animated.Text
              key={`${chars.length - i}-${char}`}
              {...(still ? {} : { entering: digitIn, exiting: FadeOut.duration(FAST_MS), layout: digitMove })}
              style={ink}
            >
              {char}
            </Animated.Text>
          ))}
          {ghost ? <Text style={[styles.amount, styles.ghost]}>{ghost}</Text> : null}
        </Animated.View>
        <Text accessibilityLiveRegion="polite" style={[styles.note, (over || phase === 'failed') && styles.noteDanger]}>{message}</Text>
        <View accessibilityLabel="Presets" style={styles.presets}>
          {presets.map((preset) => (
            <Pressable
              key={preset}
              accessibilityLabel={`${currency}${preset}`}
              accessibilityRole="button"
              aria-disabled={locked}
              aria-selected={amount === preset}
              disabled={locked}
              hitSlop={6}
              style={[styles.chip, amount === preset && styles.chipOn]}
              onPress={() => setText(String(preset))}
            >
              <Text style={[styles.chipText, amount === preset && styles.chipTextOn, locked && styles.chipTextOff]}>{currency}{preset}</Text>
            </Pressable>
          ))}
        </View>
        <View accessibilityLabel="Keypad" style={styles.keys}>
          {KEYS.map((key) => <PadKey key={key} value={key} disabled={locked} still={still} renderIcon={renderIcon} onPress={() => press(key)} />)}
        </View>
        <Button
          size="lg"
          variant={phase === 'failed' ? 'destructive' : 'primary'}
          status={phase === 'sending' ? 'loading' : phase === 'sent' ? 'success' : 'idle'}
          loadingLabel="Sending"
          successLabel="Sent"
          animated={animated}
          disabled={locked && phase !== 'sending' && phase !== 'sent' ? true : !amount || over}
          {...(phase === 'idle' && amount && !over ? { trailingIcon: iconFor(renderIcon, 'arrow-up', 16, colors.textInverse) } : {})}
          style={styles.action}
          onPress={() => void send()}
        >
          {label}
        </Button>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  pad: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2] },
  avatar: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, height: 36, justifyContent: 'center', width: 36 },
  avatarText: type(14, c.textInverse, '500'),
  who: { flex: 1, minWidth: 0 },
  small: type(12, c.textSecondary),
  name: type(16, c.textPrimary, '500'),
  currency: type(10, c.textTertiary, '400', true),
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[3], padding: space[5] },
  chars: { flexDirection: 'row', justifyContent: 'center', overflow: 'hidden' },
  amount: { ...type(48, c.textPrimary, '600'), lineHeight: 56 },
  amountEmpty: { color: c.textQuaternary },
  amountOver: { color: c.danger },
  ghost: { color: c.textQuaternary },
  note: { ...type(12, c.textTertiary), minHeight: 20, textAlign: 'center' },
  noteDanger: { color: c.danger },
  presets: { flexDirection: 'row', gap: space[2], justifyContent: 'center' },
  chip: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 32, justifyContent: 'center', paddingHorizontal: space[3] },
  chipOn: { backgroundColor: c.inverse },
  chipText: type(14, c.textPrimary, '500'),
  chipTextOn: { color: c.textInverse },
  chipTextOff: { color: c.textQuaternary },
  keys: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[1.5] },
  key: { alignItems: 'center', borderRadius: radius.control, height: 56, justifyContent: 'center', width: '33.33%' },
  keyText: type(24, c.textPrimary, '600'),
  keyOff: { color: c.ink10 },
  action: { width: '100%' },
})
