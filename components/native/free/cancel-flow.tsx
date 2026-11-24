import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button } from './button'
import { EASE_STANDARD, Panel, ROW_MS, type RenderIcon, type, useStill, useThemed } from './card'
import { Radio } from './radio'
import { Textarea } from './textarea'

export type CancelReason = { value: string; label: string; description: string }

export type CancelFlowProps = {
  plan: string
  /** `Halcyon Studio · 8 seats · $96 a month`. */
  summary: string
  renews: string
  reasons: CancelReason[]
  /** The offer step's words. */
  offer: { title: string; body: string; price: string; detail: string; tag: string; pause?: string; accept: string }
  /** Words on the last step. */
  confirm?: { title: string; body: string; action: string }
  noteHint?: string
  notePlaceholder?: string
  noteLimit?: number
  renderIcon: RenderIcon
  onAccept?: (reason: string | undefined) => void
  onCancel?: (reason: string | undefined, note: string) => void | Promise<void>
  /** The step to start on. */
  defaultStep?: 0 | 1 | 2
  defaultReason?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const STEPS = ['Reason', 'Offer', 'Confirm']
const CONFIRM = { title: 'Cancel your plan?', body: 'You keep access until the end of this billing period. Nothing is deleted.', action: 'Cancel plan' }
const swapIn = FadeInDown.duration(ROW_MS).easing(EASE_STANDARD).withInitialValues({ transform: [{ translateY: 8 }] })

/** A three step cancellation: a reason, a retention offer, then a final confirm. */
export function CancelFlow({ plan, summary, renews, reasons, offer, confirm = CONFIRM, noteHint, notePlaceholder, noteLimit = 500, renderIcon, onAccept, onCancel, defaultStep = 0, defaultReason, animated = true, style }: CancelFlowProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [step, setStep] = useState<number>(defaultStep)
  const [reason, setReason] = useState(defaultReason)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'kept' | 'cancelled'>('idle')
  const finished = status === 'kept' || status === 'cancelled'

  async function finish(): Promise<void> {
    setStatus('working')
    await Promise.resolve(onCancel?.(reason, note)).catch(() => undefined)
    setStatus('cancelled')
  }

  return (
    <Panel title={plan} subtitle={summary} label="Cancel plan" animated={animated} actions={<Badge size="sm" mark>{renews}</Badge>} style={style}>
      <View style={styles.body}>
        <View style={styles.steps}>
          {STEPS.map((name, i) => (
            <View key={name} accessible accessibilityLabel={`${name}${i === step ? ', current step' : ''}`} style={styles.step}>
              <View style={[styles.stepBar, i <= step && styles.stepOn]} />
              <Text style={[styles.small, i === step && styles.now]}>{name}</Text>
            </View>
          ))}
        </View>
        <Animated.View key={finished ? status : step} {...(still ? {} : { entering: swapIn, exiting: FadeOut.duration(ROW_MS) })} style={styles.view}>
          {status === 'kept' ? (
            <><Text style={styles.title} accessibilityRole="header">Your plan stays</Text><Text style={styles.lead}>{offer.price} starts on your next invoice.</Text></>
          ) : status === 'cancelled' ? (
            <><Text style={styles.title} accessibilityRole="header">Your plan is cancelled</Text><Text style={styles.lead}>We have sent a confirmation by email.</Text></>
          ) : step === 0 ? (
            <>
              <Text style={styles.title} accessibilityRole="header">Why are you cancelling?</Text>
              <Text style={styles.lead}>Your answer shapes what we suggest next. Nothing changes until you confirm on the last step.</Text>
              <View accessibilityRole="radiogroup" style={styles.reasons}>
                {reasons.map((entry) => {
                  const on = reason === entry.value
                  return (
                    <Pressable key={entry.value} accessibilityRole="radio" accessibilityLabel={`${entry.label}. ${entry.description}`} aria-checked={on} onPress={() => setReason(entry.value)} style={[styles.reason, on && styles.reasonOn]}>
                      <View style={styles.reasonText}><Text style={styles.label}>{entry.label}</Text><Text style={styles.small}>{entry.description}</Text></View>
                      <Radio checked={on} onChange={() => setReason(entry.value)} accessibilityLabel={entry.label} animated={animated} />
                    </Pressable>
                  )
                })}
              </View>
              <Text style={styles.label}>Add a note <Text style={styles.small}>Optional</Text></Text>
              <Textarea rows={4} limit={noteLimit} value={note} animated={animated} {...(notePlaceholder ? { placeholder: notePlaceholder } : {})} accessibilityLabel="Add a note" onChangeText={setNote} />
              {noteHint ? <Text style={styles.small}>{noteHint}</Text> : null}
            </>
          ) : step === 1 ? (
            <>
              <Text style={styles.title} accessibilityRole="header">{offer.title}</Text>
              <Text style={styles.lead}>{offer.body}</Text>
              <View style={styles.offer}>
                <View style={styles.reasonText}><Text style={styles.price}>{offer.price}</Text><Text style={styles.small}>{offer.detail}</Text></View>
                <Badge size="sm" tone="success" mark>{offer.tag}</Badge>
              </View>
              {offer.pause ? <View style={styles.pause}>{renderIcon('info', 14)}<Text style={styles.pauseText}>{offer.pause}</Text></View> : null}
            </>
          ) : (
            <><Text style={styles.title} accessibilityRole="header">{confirm.title}</Text><Text style={styles.lead}>{confirm.body}</Text></>
          )}
        </Animated.View>
        {finished ? null : (
          <View style={styles.footer}>
            {step === 0 ? <View /> : <Button variant="ghost" shape="pill" animated={animated} onPress={() => setStep(step === 1 ? 2 : 1)}>{step === 1 ? 'Cancel anyway' : 'Back'}</Button>}
            {step === 0 ? <Button shape="pill" animated={animated} disabled={!reason} onPress={() => setStep(1)}>Continue</Button> : null}
            {step === 1 ? <Button shape="pill" animated={animated} onPress={() => { onAccept?.(reason); setStatus('kept') }}>{offer.accept}</Button> : null}
            {step === 2 ? <Button variant="destructive" shape="pill" animated={animated} status={status === 'working' ? 'loading' : 'idle'} onPress={() => void finish()}>{confirm.action}</Button> : null}
          </View>
        )}
      </View>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  body: { gap: space[4], padding: space[4] },
  steps: { flexDirection: 'row', gap: space[2] },
  step: { flex: 1, gap: space[1] },
  stepBar: { backgroundColor: c.ink8, borderRadius: radius.full, height: 4 },
  stepOn: { backgroundColor: c.inverse },
  small: type(12, c.textSecondary),
  now: { color: c.textPrimary },
  view: { gap: space[3] },
  title: type(20, c.textPrimary, '500'),
  lead: type(14, c.textSecondary),
  reasons: { gap: space[2] },
  reason: { alignItems: 'center', borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', gap: space[3], minHeight: 56, padding: space[3] },
  reasonOn: { borderColor: c.textPrimary },
  reasonText: { flex: 1, gap: space[0.5] },
  label: type(14, c.textPrimary, '500'),
  offer: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.control, flexDirection: 'row', gap: space[3], padding: space[4] },
  price: type(20, c.textPrimary, '500'),
  pause: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  pauseText: { ...type(12, c.textSecondary), flex: 1 },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
})
