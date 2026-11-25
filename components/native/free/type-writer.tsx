import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const TYPE_MS = 70
const ERASE_MS = 35
const HOLD_MS = 1400
const SELECT_MS = 500
const BLINK_MS = 500

export type TextShellProps = { name: string; state?: string; style?: StyleProp<ViewStyle>; children: ReactNode }

/** The Soft tray the text effects sit in: the effect's name, its state and an inset card. */
export function TextShell({ name, state, style, children }: TextShellProps) {
  const styles = useThemed(makeStyles)
  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        {state ? <Text style={styles.state}>{state}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  )
}

export type TypeWriterStep = {
  text: string
  /** A wrong letter typed at this index, then erased. */
  typoAt?: number
  /** `select` highlights the word before replacing it. Default erase. */
  leave?: 'erase' | 'select'
}

export type TypeWriterProps = {
  steps: (string | TypeWriterStep)[]
  /** Style Soft puts it in the shell. Default `soft`. */
  styleKind?: 'soft' | 'original'
  loop?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const normal = (step: string | TypeWriterStep | undefined): TypeWriterStep => (typeof step === 'string' ? { text: step } : step ?? { text: '' })

/** Types words like a person: typos, a selection and a blinking caret. */
export function TypeWriter({ steps, styleKind = 'soft', loop = true, animated = true, style }: TypeWriterProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'typing' | 'typo' | 'selecting' | 'idle'>('typing')
  const blink = useSharedValue(1)
  const all = steps.map(normal).map((step) => step.text).join(', ')
  const key = steps.map(normal).map((step) => step.text).join('|')
  const solid = phase === 'typing' || phase === 'typo'

  useEffect(() => {
    cancelAnimation(blink)
    blink.value = 1
    if (still || solid) return undefined
    blink.value = withRepeat(withSequence(withTiming(1, { duration: BLINK_MS }), withTiming(0, { duration: 0 }), withTiming(0, { duration: BLINK_MS }), withTiming(1, { duration: 0 })), -1)
    return () => cancelAnimation(blink)
  }, [still, solid, blink])

  useEffect(() => {
    if (still) return undefined
    let alive = true
    // The pending pause is cleared on unmount, so no timer outlives the component.
    let pause: ReturnType<typeof setTimeout> | undefined
    const wait = (ms: number): Promise<void> => new Promise((done) => { pause = setTimeout(done, ms) })
    async function run(): Promise<void> {
      for (let index = 0; alive; index = loop ? (index + 1) % steps.length : index + 1) {
        const step = steps.length > index ? normal(steps[index]) : null
        if (!step) { setPhase('idle'); return }
        setPhase('typing')
        for (let i = 1; i <= step.text.length && alive; i += 1) {
          if (step.typoAt === i - 1) {
            setPhase('typo')
            setText(`${step.text.slice(0, i - 1)}o`)
            await wait(TYPE_MS * 4)
            setPhase('typing')
          }
          setText(step.text.slice(0, i))
          await wait(TYPE_MS)
        }
        setPhase('idle')
        await wait(HOLD_MS)
        if (!loop && index === steps.length - 1) return
        if (step.leave === 'select') {
          setPhase('selecting')
          await wait(SELECT_MS)
          setText('')
        } else {
          for (let i = step.text.length; i >= 0 && alive; i -= 1) {
            setText(step.text.slice(0, i))
            await wait(ERASE_MS)
          }
        }
      }
    }
    void run()
    return () => { alive = false; clearTimeout(pause) }
  }, [still, loop, key]) // eslint-disable-line react-hooks/exhaustive-deps -- `key` stands for `steps`.

  const caret = useAnimatedStyle(() => ({ opacity: blink.value }))
  const line = (
    <View accessible accessibilityLabel={all} style={styles.line}>
      <Text style={[styles.word, phase === 'selecting' ? styles.selected : null]}>{still ? normal(steps.at(-1)).text : text}</Text>
      {still ? null : <Animated.View style={[styles.caret, caret]} />}
    </View>
  )
  if (styleKind === 'original') return <View style={style}>{line}</View>
  return <TextShell name="Type Writer" state={still ? 'idle' : phase} {...(style ? { style } : {})}>{line}</TextShell>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], minHeight: 36, paddingHorizontal: space[3] },
  name: type(14, c.textPrimary, '500'),
  state: type(12, c.textTertiary, '400', true),
  body: { padding: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 34 },
  word: { ...type(18, c.textPrimary, '600'), lineHeight: 24 },
  selected: { backgroundColor: c.ink10 },
  caret: { width: 2, height: 18, marginLeft: space[0.5], backgroundColor: c.textPrimary },
})
