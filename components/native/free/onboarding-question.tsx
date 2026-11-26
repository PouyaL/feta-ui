import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { withInk, SELF } from './button'
import { Button } from './button'
import { Panel, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Kbd } from './kbd'
import { Meter } from './usage-meter'

export type OnboardingChoice = { value: string; label: string; description: string; icon: ReactNode }

/** A ready set for the common role question. Icons come from your icon set. */
export const roleChoices = (renderIcon: RenderIcon): OnboardingChoice[] => [
  { value: 'engineering', label: 'Engineering', description: 'Ship features and review code', icon: renderIcon('source-code', 16) },
  { value: 'design', label: 'Design', description: 'Specs, reviews and handoff', icon: renderIcon('drafting-compass', 16) },
  { value: 'product', label: 'Product', description: 'Roadmaps and planning', icon: renderIcon('compass', 16) },
  { value: 'marketing', label: 'Marketing', description: 'Launches and campaigns', icon: renderIcon('megaphone', 16) },
]

export type OnboardingQuestionProps = {
  question: string
  description?: string
  /** Default `roleChoices(renderIcon)`. */
  choices?: OnboardingChoice[]
  /** 1 based. */
  step: number
  steps: number
  value?: string
  defaultValue?: string
  renderIcon: RenderIcon
  onValueChange?: (value: string) => void
  onContinue?: (value: string) => void
  onSkip?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One onboarding question: progress, Skip, choice cards with number keys, and Continue. */
export function OnboardingQuestion({ question, description, choices, step, steps, value, defaultValue, renderIcon, onValueChange, onContinue, onSkip, animated = true, style }: OnboardingQuestionProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const colors = useColors()
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held
  function choose(next: string): void {
    setHeld(next)
    onValueChange?.(next)
  }
  return (
    <Panel animated={animated} label={question} style={style}>
      <View style={styles.body}>
        <Meter value={step / steps} label={`Question ${step} of ${steps}`} animated={animated} />
        <View style={styles.top}>
          <Text style={styles.count}>Question {step} of {steps}</Text>
          {onSkip ? <Button style={SELF.center} variant="link" size="sm" animated={animated} onPress={onSkip}>Skip</Button> : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">{question}</Text>
        {description ? <Text style={styles.sub}>{description}</Text> : null}
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {(choices ?? roleChoices(renderIcon)).map((choice, index) => {
            const on = current === choice.value
            return (
              <Animated.View key={choice.value} {...(still ? {} : { entering: rowEnter(index) })}>
                <Pressable accessibilityRole="radio" accessibilityLabel={`${choice.label}. ${choice.description}`} aria-checked={on} onPress={() => choose(choice.value)} style={({ pressed }) => [styles.choice, on && styles.on, pressed && !on && styles.pressed]}>
                  <View style={styles.icon}>{withInk(choice.icon, colors.textSecondary)}</View>
                  <View style={styles.text}><Text style={styles.label}>{choice.label}</Text><Text style={styles.caption}>{choice.description}</Text></View>
                  <View aria-hidden style={styles.key}><Kbd size="sm" animated={animated}>{String(index + 1)}</Kbd></View>
                </Pressable>
              </Animated.View>
            )
          })}
        </View>
        <View style={styles.footer}>
          <Button shape="pill" style={styles.continue} animated={animated} trailingIcon={renderIcon('chevron-right', 14)} disabled={!current} onPress={() => { if (current) onContinue?.(current) }}>Continue</Button>
        </View>
      </View>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  body: { gap: space[3], padding: space[4] },
  top: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between', minHeight: 20 },
  count: { ...type(12, c.textTertiary), lineHeight: 16 },
  title: { ...type(24, c.textPrimary, '600'), lineHeight: 32, marginTop: space[1] },
  sub: { ...type(16, c.textSecondary), lineHeight: 24, marginTop: -space[2] },
  choices: { gap: space[2] },
  choice: { borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, gap: space[2], padding: space[3.5] },
  on: { backgroundColor: c.ink4, borderColor: c.textPrimary, borderWidth: 1.5, padding: space[3.5] - 0.5 },
  pressed: { backgroundColor: c.ink4 },
  icon: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', height: 24 },
  text: { minWidth: 0 },
  label: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  caption: { ...type(12, c.textSecondary), lineHeight: 16 },
  key: { position: 'absolute', right: 12, top: 12 },
  footer: { alignItems: 'flex-end' },
  continue: { alignSelf: 'flex-end' },
})
