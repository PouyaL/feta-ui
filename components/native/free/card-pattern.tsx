import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInLeft, FadeInRight, FadeOut } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Badge } from './badge'
import { Button, withInk, SELF } from './button'
import { Card, QrArt, type RenderIcon, type, useFlash, useStill, useThemed } from './card'
import { Field } from './field'
import { IconButton } from './icon-button'
import { Input } from './input'
import { RollingText } from './label'

/** Pattern step: 240 ms, x 16 to 0. */
const STEP_MS = 240
const STEP_SHIFT = 16
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const forward = FadeInRight.duration(STEP_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: STEP_SHIFT }] })
const backward = FadeInLeft.duration(STEP_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: -STEP_SHIFT }] })
const money = (value: number): string => `$${value.toFixed(2)}`

type Base = { animated?: boolean; style?: StyleProp<ViewStyle> }

function Step({ stepKey, direction, still, children }: { stepKey: string; direction: 1 | -1; still: boolean; children: ReactNode }) {
  const styles = useThemed(createStyles)
  return <Animated.View key={stepKey} {...(still ? {} : { entering: direction > 0 ? forward : backward, exiting: FadeOut.duration(STEP_MS / 2) })} style={styles.stack}>{children}</Animated.View>
}

export type SignInCardProps = Base & {
  /** Product name, after "Sign in to". */
  product?: string
  /** Default Orbit and Codeharbor. */
  providers?: string[]
  mark?: ReactNode
  renderIcon: RenderIcon
  onProvider?: (provider: string) => void
  onMagicLink?: (email: string) => void
  legal?: ReactNode
}

/** Providers, a magic link, and legal copy on the tray. */
export function SignInCard({ product = 'Halden', providers = ['Orbit', 'Codeharbor'], mark, renderIcon, onProvider, onMagicLink, legal = 'By continuing, you agree to the Terms and Privacy Policy.', animated = true, style }: SignInCardProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const [email, setEmail] = useState('')
  const filled = email.trim().length > 0
  const send = (): void => { if (filled) onMagicLink?.(email) }
  // The web layout: a centred heading under a round ink mark, providers, an "or" rule, then the email form.
  return (
    <Card animated={animated} style={style} bodyStyle={styles.signInBody} footerStyle={styles.legalFooter} footer={<Text style={styles.legal}>{legal}</Text>}>
      <View style={styles.signIn}>
        <View style={styles.headingCentered}>
          <View style={styles.mark}>{withInk(mark ?? renderIcon('sparkles', 20), colors.textInverse)}</View>
          <View style={styles.headingText}><Text style={[styles.titleLg, styles.centered]} accessibilityRole="header">Sign in to {product}</Text><Text style={styles.description}>Welcome back. No password needed.</Text></View>
        </View>
        <View style={styles.providers}>
          {providers.map((provider) => <Button key={provider} variant="secondary" animated={animated} style={styles.provider} onPress={() => onProvider?.(provider)}>{provider}</Button>)}
        </View>
        <View accessibilityRole="none" style={styles.orRow}><View style={styles.orLine} /><Text style={styles.or}>or</Text><View style={styles.orLine} /></View>
        <View style={styles.form}>
          <Field label="Work email" animated={animated}><Input size="sm" type="email" autoComplete="email" autoCapitalize="none" placeholder="you@company.example" value={email} onChangeText={setEmail} onSubmitEditing={send} animated={animated} /></Field>
          <Button style={styles.wide} trailingIcon={renderIcon('arrow-right', 16)} {...(filled ? { feedback: { loading: 'Sending', success: 'Link sent' } } : {})} animated={animated} onPress={send}>Send magic link</Button>
        </View>
      </View>
    </Card>
  )
}

export type OrderSummaryCardProps = Base & {
  name?: string
  detail?: string
  /** Before the promo, in dollars. */
  subtotal?: number
  /** Taken off when the promo applies. */
  discount?: number
  discountLabel?: string
  /** Default 8.5, in percent. */
  taxRate?: number
  defaultPromo?: string
  /** Default true: the promo in `defaultPromo` starts applied. */
  defaultApplied?: boolean
  renderIcon: RenderIcon
  onPay?: (total: number) => void
}

/** A promo field, lines, a total and Pay. The total rolls when the promo changes it. */
export function OrderSummaryCard({ name = 'Field notes, yearly', detail = 'Unlimited notebooks and sync', subtotal = 96, discount = 24, discountLabel = 'Two months free', taxRate = 8.5, defaultPromo = 'WELCOME10', defaultApplied = true, renderIcon, onPay, animated = true, style }: OrderSummaryCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [promo, setPromo] = useState(defaultPromo)
  const [applied, setApplied] = useState(defaultApplied)
  const off = applied ? discount : 0
  const tax = (subtotal - off) * (taxRate / 100)
  const total = subtotal - off + tax
  return (
    <Card animated={animated} style={style} footerStyle={styles.column} footer={<><Button leadingIcon={renderIcon('lock', 16)} feedback={{ loading: 'Paying', success: 'Paid' }} animated={animated} onPress={() => onPay?.(total)}>Pay {money(total)}</Button><Text style={styles.legal}>Encrypted payment</Text></>}>
      <Text style={styles.title} accessibilityRole="header">Order summary</Text>
      <View style={styles.line}>
        <View style={styles.tile}>{renderIcon('bookmark', 20)}</View>
        <View style={styles.text}><Text style={styles.name}>{name}</Text><Text style={styles.small}>{detail}</Text></View>
        <Text style={styles.name}>{money(subtotal)}</Text>
      </View>
      <View style={styles.line}>
        <View style={styles.text}><Input size="sm" accessibilityLabel="Promo code" autoCapitalize="characters" value={promo} onChangeText={(next) => { setPromo(next); setApplied(false) }} animated={animated} /></View>
        <Button style={SELF.center} variant="secondary" {...(promo.trim().length > 0 ? { feedback: { success: 'Applied' } } : {})} animated={animated} onPress={() => setApplied(promo.trim().length > 0)}>Apply</Button>
      </View>
      <View style={styles.rule} />
      <View style={styles.spread}><Text style={styles.small}>Subtotal</Text><Text style={styles.small}>{money(subtotal)}</Text></View>
      <View style={styles.spread}><Text style={styles.small}>{discountLabel}</Text><RollingText value={applied ? `−${money(discount)}` : money(0)} still={still} style={styles.good} /></View>
      <View style={styles.spread}><Text style={styles.small}>Sales tax ({taxRate}%)</Text><RollingText value={money(tax)} still={still} style={styles.small} /></View>
      <View style={styles.rule} />
      <View style={styles.spread}><Text style={styles.name}>Total</Text><RollingText value={money(total)} still={still} style={styles.total} /></View>
    </Card>
  )
}

export type OnboardingStep = { title: string; description: string }

export type OnboardingCardProps = Base & {
  steps?: OnboardingStep[]
  illustration?: ReactNode
  renderIcon: RenderIcon
  onSkip?: () => void
  onDone?: () => void
}

const ONBOARDING: OnboardingStep[] = [
  { title: 'Create your first workspace', description: 'Each project gets one home. Start with Q4 planning and invite the team later.' },
  { title: 'Invite your team', description: 'Add people by email. They join with the access you pick.' },
  { title: 'Bring in your files', description: 'Drop in what you have. Everything stays searchable from one place.' },
]

/** An illustration, a progress pill, and Skip, Back and Next on the tray. */
export function OnboardingCard({ steps = ONBOARDING, illustration, renderIcon, onSkip, onDone, animated = true, style }: OnboardingCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [[step, direction], setStep] = useState<[number, 1 | -1]>([0, 1])
  const current = steps[step]
  const last = step === steps.length - 1
  return (
    <Card
      animated={animated}
      style={style}
      footerStyle={styles.split}
      footer={(
        <>
          <Button variant="ghost" animated={animated} onPress={onSkip}>Skip</Button>
          <View style={styles.nav}>
            <Button variant="secondary" disabled={step === 0} animated={animated} onPress={() => setStep([step - 1, -1])}>Back</Button>
            <Button trailingIcon={renderIcon('arrow-right', 16)} animated={animated} onPress={() => (last ? onDone?.() : setStep([step + 1, 1]))}>{last ? 'Done' : 'Next'}</Button>
          </View>
        </>
      )}
    >
      <View style={styles.art}>{illustration ?? ['file-text', 'file-validation', 'file'].map((icon) => <View key={icon} style={styles.tile}>{renderIcon(icon, 22)}</View>)}</View>
      <Step stepKey={String(step)} direction={direction} still={still}>
        <Text style={styles.titleLg} accessibilityRole="header">{current?.title}</Text>
        <Text style={styles.small}>{current?.description}</Text>
      </Step>
      <View accessible accessibilityRole="image" accessibilityLabel={`Step ${step + 1} of ${steps.length}`} style={styles.progress}>
        {steps.map((item, index) => <View key={item.title} style={[styles.pip, index === step && styles.pipOn]} />)}
      </View>
    </Card>
  )
}

export type StepperCardProps = Base & {
  steps?: { label: string; title: string; description: string; field: string; placeholder?: string; defaultValue?: string }[]
  renderIcon: RenderIcon
  onDone?: (values: string[]) => void
}

const STEPPER: NonNullable<StepperCardProps['steps']> = [
  { label: 'Project details', title: 'Project details', description: 'A little context helps the team find it later.', field: 'Project name', defaultValue: 'Arc launch' },
  { label: 'Assign owner', title: 'Assign owner', description: 'One person answers for it. You can change this later.', field: 'Owner email', placeholder: 'you@company.example' },
]

/** Numbered steps with one field each, and Back and Continue on the tray. */
export function StepperCard({ steps = STEPPER, renderIcon, onDone, animated = true, style }: StepperCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [[step, direction], setStep] = useState<[number, 1 | -1]>([0, 1])
  const [values, setValues] = useState(() => steps.map((item) => item.defaultValue ?? ''))
  const current = steps[step]
  const last = step === steps.length - 1
  return (
    <Card
      animated={animated}
      style={style}
      footerStyle={styles.split}
      footer={(
        <>
          <Text style={styles.small}>Step {step + 1} of {steps.length}</Text>
          <View style={styles.nav}>
            <Button variant="secondary" disabled={step === 0} animated={animated} onPress={() => setStep([step - 1, -1])}>Back</Button>
            <Button animated={animated} onPress={() => (last ? onDone?.(values) : setStep([step + 1, 1]))}>{last ? 'Finish' : 'Continue'}</Button>
          </View>
        </>
      )}
    >
      <View style={styles.stepRow}>
        {steps.map((item, index) => (
          <View key={item.label} accessible accessibilityLabel={`${item.label}${index === step ? ', current step' : ''}`} style={styles.stepItem}>
            <View style={[styles.index, index <= step && styles.indexOn]}>{index < step ? renderIcon('check', 14) : <Text style={index === step ? styles.indexTextOn : styles.small}>{index + 1}</Text>}</View>
            <Text style={index === step ? styles.name : styles.small} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Step stepKey={String(step)} direction={direction} still={still}>
        <Text style={styles.title} accessibilityRole="header">{current?.title}</Text>
        <Text style={styles.small}>{current?.description}</Text>
        <Field label={current?.field ?? ''} animated={animated}>
          <Input size="sm" {...(current?.placeholder ? { placeholder: current.placeholder } : {})} value={values[step] ?? ''} onChangeText={(next) => setValues(values.map((value, index) => (index === step ? next : value)))} animated={animated} />
        </Field>
      </Step>
    </Card>
  )
}

export type TwoFactorCardProps = Base & {
  /** The setup key, shown spaced. */
  secret: string
  stepLabel?: string
  apps?: string[]
  /** A real QR code. The default is a stand-in. */
  qr?: ReactNode
  renderIcon: RenderIcon
  /** React Native ships no clipboard, so the app writes the key, spaces removed. */
  onCopy?: (key: string) => void
  onContinue?: () => void
}

/** A QR in avatar ink, and the key with a copy button. */
export function TwoFactorCard({ secret, stepLabel = 'Step 1 of 3', apps = ['Passkeep', 'Lockwell'], qr, renderIcon, onCopy, onContinue, animated = true, style }: TwoFactorCardProps) {
  const styles = useThemed(createStyles)
  const [copied, flash] = useFlash()
  return (
    <Card animated={animated} style={style} footer={<Button feedback={{ loading: 'Verifying', success: 'Verified' }} animated={animated} onPress={onContinue}>Continue</Button>}>
      <View style={styles.spread}><Text style={styles.title} accessibilityRole="header">Two-factor authentication</Text><Badge size="sm" mark={false} animated={animated}>{stepLabel}</Badge></View>
      <View style={styles.line}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{qr ?? <QrArt seed={secret} size={104} finderRadius={1.2} />}</View>
        <View style={styles.text}>
          <Text style={styles.name}>Scan the QR code</Text>
          <Text style={styles.small}>Open your authenticator app and scan this code to link your account.</Text>
          <View style={styles.apps}>{apps.map((app) => <Badge key={app} size="sm" mark={false} animated={animated}>{app}</Badge>)}</View>
        </View>
      </View>
      <Text style={styles.small}>Can’t scan it? Enter this key</Text>
      <View style={styles.keyBox}>
        <Text style={styles.key} selectable>{secret}</Text>
        <IconButton style={SELF.center} variant="ghost" size="sm" icon={renderIcon(copied ? 'check' : 'copy', 16)} label={copied ? 'Copied' : 'Copy key'} animated={animated} onPress={() => { onCopy?.(secret.replaceAll(' ', '')); flash() }} />
      </View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  stack: { gap: space[2] },
  heading: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  tile: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.xl, height: 44, justifyContent: 'center', width: 44 },
  text: { flex: 1, gap: space[0.5] },
  title: type(16, c.textPrimary, '500'),
  titleLg: { ...type(18, c.textPrimary, '600'), lineHeight: 26 },
  centered: { textAlign: 'center' },
  name: type(14, c.textPrimary, '500'),
  small: type(12, c.textSecondary),
  legal: { ...type(12, c.textTertiary), flex: 1, lineHeight: 16, textAlign: 'center' },
  legalFooter: { justifyContent: 'center', paddingBottom: space[1.5], paddingHorizontal: space[4], paddingTop: space[2.5] },
  signInBody: { paddingBottom: space[6], paddingHorizontal: space[6], paddingTop: space[7] },
  signIn: { gap: space[5] },
  headingCentered: { alignItems: 'center', gap: space[3] },
  headingText: { alignItems: 'center', gap: space[1] },
  mark: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, height: 40, justifyContent: 'center', width: 40 },
  description: { ...type(16, c.textSecondary), lineHeight: 22, textAlign: 'center' },
  orRow: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  orLine: { backgroundColor: c.ink8, flex: 1, height: 1 },
  form: { gap: space[5] },
  or: { ...type(12, c.textTertiary), textAlign: 'center' },
  // Like the web grid at phone width: providers stack on a phone column and share a row when there is room.
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  provider: { flexBasis: 160, flexGrow: 1, minWidth: 0 },
  wide: { alignSelf: 'stretch' },
  column: { alignItems: 'stretch', flexDirection: 'column' },
  split: { justifyContent: 'space-between' },
  nav: { flexDirection: 'row', gap: space[2] },
  line: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  spread: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  rule: { backgroundColor: c.ink8, height: StyleSheet.hairlineWidth },
  good: type(12, c.success),
  total: type(20, c.textPrimary, '600'),
  art: { flexDirection: 'row', gap: space[2], justifyContent: 'center', paddingVertical: space[4] },
  progress: { flexDirection: 'row', gap: space[1], justifyContent: 'center' },
  pip: { backgroundColor: c.ink10, borderRadius: radius.full, height: 4, width: 8 },
  pipOn: { backgroundColor: c.inverse, width: 20 },
  stepRow: { flexDirection: 'row', gap: space[3] },
  stepItem: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[1.5] },
  index: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 24, justifyContent: 'center', width: 24 },
  indexOn: { backgroundColor: c.inverse },
  indexTextOn: type(12, c.textInverse, '600'),
  apps: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  keyBox: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.field, flexDirection: 'row', minHeight: 44, paddingLeft: space[3] },
  key: { color: c.textPrimary, flex: 1, fontFamily: font.mono, fontSize: 14 },
})
