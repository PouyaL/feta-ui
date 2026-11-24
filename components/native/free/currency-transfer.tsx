import { useEffect } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeOut, LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Avatar, type AvatarPerson } from './avatar'
import { Badge, type BadgeTone } from './badge'
import { stampIn } from './boarding-pass'
import { Button, withInk } from './button'
import { Card, type RenderIcon, type, useFlash, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Spinner } from './spinner'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
/** Step completes: the line fills down in 300 ms. */
const LINE = { duration: 300, easing: EASE_OUT }
const DIM = { duration: 260, easing: EASE_OUT }
const FAILED_OPACITY = 0.4
const COPIED_MS = 1600
const stampOut = FadeOut.duration(120)

export type TransferStatus = 'processing' | 'completed' | 'failed'
type StepState = 'done' | 'active' | 'failed' | 'waiting'

export type TransferStep = {
  title: string
  meta: string
  /** Shown once this step is done, if the wording changes. */
  doneTitle?: string
  doneMeta?: string
  /** Shown if the transfer fails on this step. */
  failedTitle?: string
  failedMeta?: string
}

export type CurrencyTransferProps = {
  recipient: { name: string; account: string; person?: AvatarPerson; src?: string }
  /** The amount received, formatted. */
  amount: string
  /** The line under the amount. */
  summary: string
  /** Default `processing`. */
  status?: TransferStatus
  steps: TransferStep[]
  /** Steps finished so far. The next one spins, or fails. Defaults to all but the last. */
  done?: number
  reference: string
  /** The line under the reference. */
  note?: string
  /** React Native ships no clipboard, so the app writes the reference here. */
  onCopy?: (reference: string) => void
  onReceipt?: () => void
  onRetry?: () => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const BADGE: Record<TransferStatus, [BadgeTone, string]> = { processing: ['info', 'In progress'], completed: ['success', 'Arrived'], failed: ['danger', 'Failed'] }
const SPOKEN: Record<StepState, string> = { done: 'Done', active: 'In progress', failed: 'Failed', waiting: 'Waiting' }

function Mark({ state, still, renderIcon }: { state: StepState; still: boolean; renderIcon: RenderIcon }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  return (
    <View style={styles.markBox}>
      <LayoutAnimationConfig skipEntering>
        <Animated.View
          key={state}
          {...(still ? {} : { entering: stampIn, exiting: stampOut })}
          style={[styles.mark, state === 'done' && styles.markDone, state === 'failed' && styles.markFailed]}
        >
          {state === 'done' ? withInk(renderIcon('tick-02', 12), colors.textInverse) : null}
          {state === 'failed' ? withInk(renderIcon('x', 12), colors.onSolid) : null}
          {state === 'active' ? <Spinner kind="bars" size={12} label={null} color={colors.textSecondary} animated={!still} /> : null}
        </Animated.View>
      </LayoutAnimationConfig>
    </View>
  )
}

function Line({ filled, still }: { filled: boolean; still: boolean }) {
  const styles = useThemed(createStyles)
  const fill = useSharedValue(filled ? 1 : 0)
  useEffect(() => {
    fill.value = still ? (filled ? 1 : 0) : withTiming(filled ? 1 : 0, LINE)
  }, [fill, filled, still])
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleY: fill.value }] }))
  return <View style={styles.track}><Animated.View style={[styles.line, grow]} /></View>
}

/** A money transfer and its steps. Steps tick in sequence and never jump back. */
export function CurrencyTransfer({ recipient, amount, summary, status = 'processing', steps, done, reference, note, onCopy, onReceipt, onRetry, renderIcon, animated = true, style }: CurrencyTransferProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [copied, flashCopied] = useFlash(COPIED_MS)

  const reached = status === 'completed' ? steps.length : Math.min(done ?? steps.length - 1, steps.length - 1)
  const stateOf = (index: number): StepState => {
    if (index < reached) return 'done'
    if (index > reached) return 'waiting'
    return status === 'failed' ? 'failed' : 'active'
  }
  const [tone, label] = BADGE[status]

  const failed = status === 'failed'
  const dim = useSharedValue(failed ? FAILED_OPACITY : 1)
  useEffect(() => {
    dim.value = still ? (failed ? FAILED_OPACITY : 1) : withTiming(failed ? FAILED_OPACITY : 1, DIM)
  }, [dim, failed, still])
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }))

  function copy(): void {
    onCopy?.(reference)
    flashCopied()
  }

  return (
    <Card
      animated={animated}
      style={[styles.transfer, style]}
      bodyStyle={styles.body}
      footerStyle={styles.footer}
      footer={
        <>
          <View style={styles.reference}>
            <Text style={styles.code} selectable>{reference}</Text>
            {note ? <Text style={styles.meta}>{note}</Text> : null}
          </View>
          {status === 'completed' ? <Button size="sm" variant="secondary" leadingIcon={renderIcon('receipt', 16)} animated={animated} onPress={onReceipt}>Receipt</Button>
            : failed ? <Button size="sm" leadingIcon={renderIcon('refresh-cw', 16)} animated={animated} onPress={onRetry}>Retry</Button>
            : <IconButton size="sm" variant="ghost" icon={renderIcon(copied ? 'check' : 'copy', 16)} label={copied ? 'Copied' : 'Copy reference'} animated={animated} onPress={copy} />}
        </>
      }
    >
      <View style={styles.content}>
        <View style={styles.recipient}>
          <Avatar size="lg" animated={animated} {...(recipient.person ? { person: recipient.person } : {})} {...(recipient.src ? { src: recipient.src } : {})} />
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>{recipient.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{recipient.account}</Text>
          </View>
          <View accessibilityLiveRegion="polite"><Badge size="sm" tone={tone} animated={animated}>{label}</Badge></View>
        </View>
        <View style={styles.amount}>
          <Animated.Text style={[styles.value, dimStyle]}>{amount}</Animated.Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>
        <View style={styles.timeline}>
          {steps.map((step, index) => {
            const state = stateOf(index)
            const title = state === 'done' ? step.doneTitle ?? step.title : state === 'failed' ? step.failedTitle ?? step.title : step.title
            const meta = state === 'done' ? step.doneMeta ?? step.meta : state === 'failed' ? step.failedMeta ?? step.meta : step.meta
            return (
              <View key={step.title} accessible accessibilityLabel={`${title}: ${SPOKEN[state]}. ${meta}`} style={styles.step}>
                <View style={styles.rail}>
                  <Mark state={state} still={still} renderIcon={renderIcon} />
                  {index < steps.length - 1 ? <Line filled={state === 'done'} still={still} /> : null}
                </View>
                <View style={styles.text}>
                  <Text style={[styles.stepTitle, state === 'failed' && styles.stepFailed]}>{title}</Text>
                  <Text style={styles.meta}>{meta}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  transfer: { maxWidth: 358, width: '100%' },
  body: { padding: space[5] },
  content: { gap: space[4.5] },
  recipient: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  who: { flex: 1, gap: space[0.5], minWidth: 0 },
  name: type(14, c.textPrimary, '500'),
  meta: type(12, c.textTertiary),
  amount: { gap: space[1] },
  value: { ...type(32, c.textPrimary, '600'), lineHeight: 38 },
  summary: type(12, c.textSecondary),
  timeline: { gap: space[0.5] },
  step: { flexDirection: 'row', gap: space[3] },
  rail: { alignItems: 'center', flexShrink: 0, gap: space[1], width: 24 },
  markBox: { height: 24, width: 24 },
  mark: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 24, justifyContent: 'center', width: 24 },
  markDone: { backgroundColor: c.inverse },
  markFailed: { backgroundColor: c.danger },
  track: { backgroundColor: c.ink10, height: 22, overflow: 'hidden', width: 2 },
  line: { ...StyleSheet.absoluteFill, backgroundColor: c.inverse, transformOrigin: 'top' },
  text: { flex: 1, gap: space[0.5], minWidth: 0, paddingTop: space[0.5] },
  stepTitle: type(14, c.textPrimary, '500'),
  stepFailed: { color: c.danger },
  footer: { justifyContent: 'space-between', paddingBottom: space[1], paddingLeft: space[3], paddingRight: space[2], paddingTop: space[2] },
  reference: { flex: 1, minWidth: 0 },
  code: { color: c.textSecondary, fontFamily: font.mono, fontSize: 12 },
})
