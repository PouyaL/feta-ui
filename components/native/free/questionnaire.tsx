import { useMemo, useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Button, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'
import { IconButton } from './icon-button'
import { Input } from './input'
import { Radio } from './radio'

/** Motion from the Questionnaire Motion frame: spring 0.28 s forward, 0.24 s back, bounce 0.3. */
const stepIn = (direction: number) => (direction > 0 ? FadeInDown.springify(280).dampingRatio(0.7) : FadeInUp.springify(240).dampingRatio(0.7)).withInitialValues({ transform: [{ translateY: 12 * direction }] })
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)

export type QuestionnaireChoiceProps = {
  mode?: 'single' | 'multiple'
  label: ReactNode
  description?: ReactNode
  checked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One answer row: Radio or Checkbox and a label. */
export function QuestionnaireChoice({ mode = 'single', label, description, checked = false, disabled = false, onCheckedChange, animated = true, style }: QuestionnaireChoiceProps) {
  const styles = useThemed(createStyles)
  const name = typeof label === 'string' ? label : undefined
  return (
    <Pressable accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'} accessibilityLabel={name} aria-checked={checked} aria-disabled={disabled} disabled={disabled} onPress={() => onCheckedChange?.(mode === 'single' ? true : !checked)} style={[styles.choice, checked && styles.choiceOn, disabled && styles.disabled, style]}>
      {mode === 'single' ? <Radio decorative checked={checked} disabled={disabled} animated={animated} /> : <Checkbox decorative checked={checked} disabled={disabled} animated={animated} />}
      <View style={styles.choiceText}><Text style={styles.choiceLabel}>{label}</Text>{description ? <Text style={styles.small}>{description}</Text> : null}</View>
    </Pressable>
  )
}

export type QuestionChoice = { value: string; label: string; description?: string; disabled?: boolean }

export type Question = {
  id: string
  title: string
  description?: string
  mode?: 'single' | 'multiple'
  choices: QuestionChoice[]
  /** Skip moves on without an answer. */
  optional?: boolean
  /** Adds a written answer under the choices, with this placeholder. */
  freeform?: string
  /** Shown as a segment name in the `progress` header. */
  checkpoint?: string
  /** Footer text while on this question. */
  hint?: string
  /** Mono note on the tray, such as `+1 if cloud`. */
  tag?: string
  /** Left out of the flow unless this is true. */
  when?: (answers: QuestionnaireAnswers) => boolean
}

export type QuestionnaireAnswer = { values: string[]; text?: string }
export type QuestionnaireAnswers = Record<string, QuestionnaireAnswer>

export type QuestionnaireProps = {
  questions: Question[]
  /** The tray header. Default `steps`. */
  header?: 'steps' | 'select' | 'progress' | 'count' | 'card'
  /** Card title on the `card` header. */
  title?: string
  value?: QuestionnaireAnswers
  defaultValue?: QuestionnaireAnswers
  onValueChange?: (answers: QuestionnaireAnswers) => void
  /** The active question. Pass with `onStepChange` to control it from the host. */
  step?: number
  defaultStep?: number
  onStepChange?: (step: number) => void
  /** Shown on the tray when the host holds the checkpoint. */
  hostLabel?: string
  /** `lock` keeps Next disabled, `report` lets it press and explains. Default `lock`. */
  validation?: 'lock' | 'report'
  errorMessage?: string
  /** The answered question folds into a line on the tray. */
  foldAnswers?: boolean
  /** Answers came from an earlier session: marks the tray and offers Reset. */
  restored?: boolean
  /** Adds Close and Cancel. */
  onCancel?: () => void
  onComplete?: (answers: QuestionnaireAnswers) => void
  nextLabel?: string
  submitLabel?: string
  backLabel?: string
  /** Footer text when a question has no hint. */
  hint?: string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const isAnswered = (question: Question | undefined, answer: QuestionnaireAnswer | undefined): boolean => Boolean(question && answer && (answer.values.length > 0 || (answer.text ?? '').trim()))

/** Asks one question at a time, single or multiple, with validation and restore. */
export function Questionnaire({ questions, header = 'steps', title, value, defaultValue = {}, onValueChange, step, defaultStep = 0, onStepChange, hostLabel, validation = 'lock', errorMessage = 'Choose an answer to continue.', foldAnswers = false, restored = false, onCancel, onComplete, nextLabel = 'Next', submitLabel, backLabel = 'Back', hint, renderIcon, animated = true, style }: QuestionnaireProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const [heldStep, setHeldStep] = useState(defaultStep)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState(false)
  const [wasRestored, setWasRestored] = useState(restored)
  const answers = value ?? held
  const flow = useMemo(() => questions.filter((question) => !question.when || question.when(answers)), [questions, answers])
  const index = Math.min(step ?? heldStep, flow.length - 1)
  const question = flow[index]
  const previous = flow[index - 1]
  const answer = question ? answers[question.id] : undefined
  const valid = !question || isAnswered(question, answer)
  const last = index === flow.length - 1
  const mode = question?.mode ?? 'single'
  const counter = `Question ${index + 1} of ${flow.length}`
  const previousAnswer = previous ? answers[previous.id] : undefined
  const previousText = previous?.choices.filter((choice) => previousAnswer?.values.includes(choice.value)).map((choice) => choice.label).join(', ')

  function setAnswers(next: QuestionnaireAnswers): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function goTo(next: number): void {
    setDirection(next > index ? 1 : -1)
    setError(false)
    setHeldStep(next)
    onStepChange?.(next)
  }

  function pick(choice: QuestionChoice, on: boolean): void {
    if (!question || choice.disabled) return
    const current = answer?.values ?? []
    const values = mode === 'multiple' ? (on ? [...current, choice.value] : current.filter((entry) => entry !== choice.value)) : [choice.value]
    setError(false)
    setAnswers({ ...answers, [question.id]: { ...answer, values } })
  }

  function next(): void {
    if (!valid) { setError(true); return }
    if (last) onComplete?.(answers)
    else goTo(index + 1)
  }

  const pills = <View style={styles.pills}>{flow.map((entry, i) => <View key={entry.id} style={[styles.pill, i === index && styles.pillNow, i < index && styles.pillDone]} />)}</View>
  const folded = foldAnswers && header === 'steps'
  let head: ReactNode
  if (folded && previous) head = <Animated.View key={previous.id} {...(still ? {} : { entering: FadeInDown.duration(280).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 8 }] }) })} style={styles.answered}>{renderIcon('check', 10)}<Text style={styles.small} numberOfLines={1}>{previous.title}</Text><Text style={styles.answer} numberOfLines={1}>{previousText}</Text></Animated.View>
  else if (header === 'select') head = <Text style={styles.mono}>{mode === 'multiple' ? 'Select all that apply' : counter}</Text>
  else if (header === 'card') head = <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
  else if (header === 'progress') head = <View style={styles.checkpoints}><View style={styles.checkpointRow}><Text style={styles.mono}>Checkpoint {index + 1} of {flow.length}</Text><Text style={styles.small}>{question?.checkpoint}</Text></View><View style={styles.bar}>{flow.map((entry, i) => <View key={entry.id} style={[styles.barPart, i <= index && styles.barOn]} />)}</View></View>
  else if (header === 'count') head = <Text style={styles.mono}>Step {index + 1}/{flow.length}</Text>
  else head = <View style={styles.count}>{pills}<Text style={styles.mono}>{counter}</Text></View>

  return (
    <View accessibilityLabel={title ?? 'Questionnaire'} style={[styles.shell, style]}>
      <View style={styles.header}>
        {head}
        <View style={styles.headerEnd}>
          {header === 'select' && mode === 'multiple' ? <Text style={styles.small}>{answer?.values.length ?? 0} selected</Text> : null}
          {header === 'card' ? <Text style={styles.ratio}>{index + 1} / {flow.length}</Text> : null}
          {question?.tag ? <Text style={styles.mono}>{question.tag}</Text> : null}
          {hostLabel ? <Text style={styles.small}>{hostLabel}</Text> : null}
          {wasRestored ? <View style={styles.restored}>{renderIcon('rotate-ccw', 14)}<Text style={styles.mono}>Restored</Text></View> : null}
          {error && validation === 'report' ? <Text style={styles.issue}>1 issue</Text> : null}
          {onCancel ? <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label="Close" icon={renderIcon('x', 16)} onPress={onCancel} /> : null}
        </View>
      </View>
      <View style={styles.card}>
        {question ? (
          <Animated.View key={question.id} {...(still ? {} : { entering: stepIn(direction), exiting: FadeOut.duration(120) })} style={styles.step}>
            {folded ? <View style={styles.count}>{pills}<Text style={styles.mono}>{counter}</Text></View> : null}
            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">{question.title}</Text>
              {question.description ? <Text style={styles.description}>{question.description}</Text> : null}
            </View>
            <View accessibilityRole={mode === 'single' ? 'radiogroup' : undefined} style={styles.choices}>
              {question.choices.map((choice) => <QuestionnaireChoice key={choice.value} mode={mode} label={choice.label} {...(choice.description ? { description: choice.description } : {})} checked={answer?.values.includes(choice.value) ?? false} disabled={choice.disabled ?? false} animated={animated} onCheckedChange={(on) => pick(choice, on)} />)}
            </View>
            {question.freeform ? (
              <View style={styles.freeform}>
                <Text style={styles.mono}>Or write your own</Text>
                <Input value={answer?.text ?? ''} placeholder={question.freeform} accessibilityLabel={question.freeform} animated={animated} onChangeText={(text) => { setError(false); setAnswers({ ...answers, [question.id]: { values: answer?.values ?? [], text } }) }} />
              </View>
            ) : null}
            {error ? <Animated.View {...(still ? {} : { entering: FadeIn.duration(200).easing(EASE_OUT) })} accessibilityRole="alert" style={styles.error}>{renderIcon('alert-circle', 16)}<Text style={styles.errorText}>{errorMessage}</Text></Animated.View> : null}
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.footerStart}>
          {onCancel ? <Button variant="ghost" size="sm" shape="pill" animated={animated} onPress={onCancel}>Cancel</Button>
            : index > 0 && !foldAnswers ? <Button variant="ghost" size="sm" shape="pill" animated={animated} leadingIcon={renderIcon('arrow-left', 14)} onPress={() => goTo(index - 1)}>{backLabel}</Button>
              : question?.optional ? <Button variant="link" size="sm" animated={animated} onPress={() => { if (last) onComplete?.(answers); else goTo(index + 1) }}>Skip for now</Button>
                : <Text style={styles.hint}>{question?.hint ?? hint}</Text>}
        </View>
        <View style={styles.actions}>
          {restored && wasRestored ? <Button style={SELF.center} variant="secondary" size="sm" shape="pill" animated={animated} onPress={() => { setAnswers({}); setWasRestored(false) }}>Reset</Button> : null}
          <Button style={SELF.center} size="sm" shape="pill" animated={animated} {...(last && submitLabel ? {} : { trailingIcon: renderIcon('arrow-right', 14) })} disabled={validation === 'lock' && !valid} {...(last && submitLabel ? { feedback: { loading: 'Sending', success: 'Sent' } } : {})} onPress={next}>{last && submitLabel ? submitLabel : nextLabel}</Button>
        </View>
      </View>
    </View>
  )
}

export type QuestionnaireDialogProps = Omit<QuestionnaireProps, 'onCancel'> & { open: boolean; onClose: () => void }

/** Questionnaire in a modal. The system back gesture closes it. */
export function QuestionnaireDialog({ open, onClose, ...rest }: QuestionnaireDialogProps) {
  const styles = useThemed(createStyles)
  return (
    <Modal visible={open} transparent animationType={rest.animated === false ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.scrim}>{open ? <Questionnaire {...rest} onCancel={onClose} /> : null}</View>
    </Modal>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  shell: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1] },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2.5], justifyContent: 'space-between', minHeight: 44, paddingLeft: space[3.5], paddingRight: space[2], paddingVertical: space[2] },
  headerEnd: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  count: { alignItems: 'center', flexDirection: 'row', gap: space[2.5] },
  pills: { flexDirection: 'row', gap: space[1] },
  pill: { backgroundColor: c.ink10, borderRadius: radius.sm, height: 6, width: 6 },
  pillNow: { backgroundColor: c.textPrimary, width: 16 },
  pillDone: { backgroundColor: c.textSecondary },
  // The web's mono micro label: 10 px, uppercase, 0.04 em apart.
  mono: { ...type(10, c.textTertiary, '400', true), letterSpacing: 0.4, lineHeight: 12, textTransform: 'uppercase' },
  ratio: { ...type(12, c.textTertiary, '400', true), lineHeight: 16 },
  small: { ...type(12, c.textSecondary), lineHeight: 16 },
  hint: { ...type(12, c.textTertiary), lineHeight: 16 },
  answered: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[2] },
  answer: { ...type(12, c.textPrimary, '500'), flexShrink: 1 },
  cardTitle: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  checkpoints: { flex: 1, gap: space[1.5], paddingRight: space[1.5], paddingTop: space[1] },
  checkpointRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 16 },
  bar: { flexDirection: 'row', gap: space[1] },
  barPart: { backgroundColor: c.ink10, borderRadius: radius.xs, flex: 1, height: 4 },
  barOn: { backgroundColor: c.textPrimary },
  restored: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  issue: type(12, c.danger),
  card: {
    backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, padding: space[4],
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10,
  },
  step: { gap: space[4] },
  heading: { gap: space[1] },
  title: { ...type(17, c.textPrimary, '600'), lineHeight: 20 },
  description: { ...type(14, c.textSecondary), lineHeight: 18 },
  choices: { gap: space[2] },
  choice: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: space[3], minHeight: 44, paddingLeft: space[4], paddingRight: space[3.5], paddingVertical: space[3.5] },
  choiceOn: { borderColor: c.textPrimary, borderWidth: 1.5, paddingLeft: space[4] - 0.5, paddingRight: space[3.5] - 0.5, paddingVertical: space[3.5] - 0.5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
  disabled: { opacity: 0.4 },
  choiceText: { flex: 1 },
  choiceLabel: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  freeform: { gap: space[2] },
  error: { alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: radius.xl, flexDirection: 'row', gap: space[2], paddingLeft: space[2.5], paddingRight: space[3], paddingVertical: space[2] },
  errorText: { ...type(14, c.danger), flexShrink: 1 },
  footer: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 40, paddingBottom: space[1], paddingLeft: space[3.5], paddingRight: space[1], paddingTop: space[2] },
  footerStart: { flexShrink: 1 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  scrim: { backgroundColor: c.ink10, flex: 1, justifyContent: 'center', padding: space[4] },
})
