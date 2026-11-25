import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { Button } from './button'
import { EASE_STANDARD, panelEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Input } from './input'
import { Toggle } from './toggle'

const UPDATE_MS = 240
const EXIT_MS = 120
const reveal = FadeInDown.duration(UPDATE_MS).easing(EASE_STANDARD).withInitialValues({ opacity: 0, transform: [{ translateY: -4 }] })
const grow = LinearTransition.duration(UPDATE_MS).easing(Easing.bezierFn(0.25, 0.1, 0.25, 1))

export type FeedbackPromptValue = { helpful: boolean; reasons: string[]; note: string }
type Stage = 'default' | 'positive' | 'negative' | 'sent'

export type FeedbackPromptProps = {
  /** Default `Was this helpful?`. */
  question?: string
  reasons?: string[]
  /** Default `Thanks, your feedback helps us improve this page.`. */
  thanks?: string
  /** Opens on a stage, for previews. */
  defaultStage?: Stage
  onSubmit?: (value: FeedbackPromptValue) => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A yes or no question. Yes opens a note, No adds reason chips, and sending says thanks. */
export function FeedbackPrompt({ question = 'Was this helpful?', reasons = ['Inaccurate', 'Hard to follow', 'Missing steps', 'Outdated'], thanks = 'Thanks, your feedback helps us improve this page.', defaultStage = 'default', onSubmit, renderIcon, animated = true, style }: FeedbackPromptProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [stage, setStage] = useState<Stage>(defaultStage)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const enter = still ? {} : { entering: reveal }
  const resize = still ? {} : { layout: grow }

  function send(): void {
    onSubmit?.({ helpful: stage === 'positive', reasons: stage === 'negative' ? picked : [], note })
    setStage('sent')
  }

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} {...resize} style={[styles.ring, style]}>
      <Animated.View {...resize} style={styles.prompt}>
        {stage === 'sent' ? (
          <Animated.View key="sent" {...enter} accessibilityLiveRegion="polite" style={styles.sent}>
            {renderIcon('check', 16)}
            <Text style={styles.sentText}>{thanks}</Text>
          </Animated.View>
        ) : (
          <Animated.View key="form" {...(still ? {} : { exiting: FadeOut.duration(EXIT_MS) })} style={styles.form}>
            <View style={styles.head}>
              <Text accessibilityRole="header" style={styles.question}>{question}</Text>
              <View style={styles.choices}>
                <Button size="sm" variant={stage === 'positive' ? 'primary' : 'secondary'} leadingIcon={renderIcon('check', 16)} {...pressedState(stage === 'positive')} animated={animated} onPress={() => setStage('positive')}>Yes</Button>
                <Button size="sm" variant={stage === 'negative' ? 'primary' : 'secondary'} leadingIcon={renderIcon('x', 16)} {...pressedState(stage === 'negative')} animated={animated} onPress={() => setStage('negative')}>No</Button>
              </View>
            </View>
            {stage === 'negative' ? (
              <Animated.View {...enter} accessibilityLabel="What went wrong" style={styles.chips}>
                {reasons.map((reason) => (
                  <Toggle key={reason} appearance="outline" animated={animated} pressed={picked.includes(reason)} onPressedChange={(on: boolean) => setPicked((all) => (on ? [...all, reason] : all.filter((r) => r !== reason)))}>{reason}</Toggle>
                ))}
              </Animated.View>
            ) : null}
            {stage === 'default' ? null : (
              <Animated.View key={stage} {...enter} style={styles.note}>
                <Input accessibilityLabel="Note" placeholder={stage === 'positive' ? 'What worked well? (optional)' : 'Tell us more (optional)'} value={note} onChangeText={setNote} animated={animated} />
                <Button size="sm" animated={animated} onPress={send}>Send feedback</Button>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  ring: { width: '100%', maxWidth: 358, padding: space[1], borderRadius: radius.frame, backgroundColor: c.ink4 },
  prompt: { paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  form: { gap: space[3] },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  question: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  choices: { flexDirection: 'row', gap: space[1.5] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5] },
  note: { alignItems: 'flex-end', gap: space[3] },
  sent: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  sentText: { ...type(13, c.textSecondary), flex: 1, lineHeight: 20 },
})
