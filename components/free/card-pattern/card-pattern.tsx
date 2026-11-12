'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { BookmarkIcon } from '@fetaui/react/rounded/bookmark'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { FileIcon } from '@fetaui/react/rounded/file'
import { FileTextIcon } from '@fetaui/react/rounded/file-text'
import { FileValidationIcon } from '@fetaui/react/rounded/file-validation'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { ease } from '../../motion-tokens'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'
import { Card, type CardProps } from '../card/card'
import { QrArt } from '../card-kit/card-kit'
import { Field } from '../field/field'
import { IconButton } from '../icon-button/icon-button'
import { Input } from '../input/input'
import { RollingText, cx, useStill } from '../motion-kit/motion-kit'
import styles from './card-pattern.module.css'

/** Pattern step: 240 ms, x 16 to 0. */
const STEP_DURATION = 0.24
const STEP_SHIFT = 16

type Base = Pick<CardProps, 'className' | 'animated'>

function Step({ stepKey, direction, still, children }: { stepKey: string; direction: 1 | -1; still: boolean; children: ReactNode }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={stepKey}
        className={styles.stack}
        initial={still ? false : { x: STEP_SHIFT * direction, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: STEP_DURATION / 2 } }}
        transition={{ duration: STEP_DURATION, ease: ease.out }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export type SignInCardProps = Base & {
  /** Product name, after "Sign in to". */
  product?: string
  /** Default Orbit and Codeharbor. */
  providers?: string[]
  mark?: ReactNode
  onProvider?: (provider: string) => void
  onMagicLink?: (email: string) => void
  legal?: ReactNode
}

/** Providers, a magic link, and legal copy on the tray. */
export function SignInCard({ product = 'Halden', providers = ['Orbit', 'Codeharbor'], mark, onProvider, onMagicLink, legal = 'By continuing, you agree to the Terms and Privacy Policy.', className, animated = true }: SignInCardProps) {
  const [email, setEmail] = useState('')
  // Set by a real submit, so an empty or invalid email never shows the sent state.
  const [sent, setSent] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onMagicLink?.(email)
    setSent(true)
  }
  return (
    <Card className={cx(styles.pattern, className)} bodyClassName={styles.signIn} footerClassName={styles.legal} footer={<p className={styles.legalText}>{legal}</p>} animated={animated}>
      <div className={styles.heading}>
        <span className={styles.mark}>{mark ?? <SparklesIcon size={20} />}</span>
        <div className={styles.headingText}>
          <h3 className={styles.titleLg}>Sign in to {product}</h3>
          <p className={styles.description}>Welcome back. No password needed.</p>
        </div>
      </div>
      <div className={styles.providers}>
        {providers.map((provider) => <Button key={provider} variant="secondary" animated={animated} onClick={() => onProvider?.(provider)}>{provider}</Button>)}
      </div>
      <div className={styles.or} role="separator"><span>or</span></div>
      <form className={styles.form} onSubmit={submit}>
        <Field label="Work email" animated={animated}>
          <Input size="sm" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} animated={animated} />
        </Field>
        <Button type="submit" trailingIcon={<ArrowRightIcon />} status={sent ? 'success' : 'idle'} successLabel="Link sent" onSuccessEnd={() => setSent(false)} animated={animated}>Send magic link</Button>
      </form>
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
  /** Checks a code. Without it, only `defaultPromo` applies. */
  onApplyPromo?: (code: string) => boolean | Promise<boolean>
  onPay?: (total: number) => void
}

const money = (value: number): string => `$${value.toFixed(2)}`

/** A promo field, lines, a total and Pay. The total rolls when the promo changes it. */
export function OrderSummaryCard({ name = 'Field notes, yearly', detail = 'Unlimited notebooks and sync', subtotal = 96, discount = 24, discountLabel = 'Two months free', taxRate = 8.5, defaultPromo = 'WELCOME10', defaultApplied = true, onApplyPromo, onPay, className, animated = true }: OrderSummaryCardProps) {
  const still = useStill(animated)
  const [promo, setPromo] = useState(defaultPromo)
  const [applied, setApplied] = useState(defaultApplied)
  const [rejected, setRejected] = useState(false)
  const [checking, setChecking] = useState<'idle' | 'loading' | 'success'>('idle')
  // Editing the code retires a check that is still running.
  const attempt = useRef(0)
  async function apply(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const code = promo.trim()
    const run = ++attempt.current
    let ok: boolean
    setChecking('loading')
    try {
      ok = code.length > 0 && (onApplyPromo ? await onApplyPromo(code) : code.toLowerCase() === defaultPromo.trim().toLowerCase())
    } catch {
      ok = false
    }
    if (run !== attempt.current) { setChecking('idle'); return }
    setChecking(ok ? 'success' : 'idle')
    setApplied(ok)
    setRejected(!ok && code.length > 0)
  }
  const off = applied ? discount : 0
  const tax = (subtotal - off) * (taxRate / 100)
  const total = subtotal - off + tax
  return (
    <Card
      className={cx(styles.pattern, className)}
      bodyClassName={styles.order}
      footerClassName={styles.payFooter}
      animated={animated}
      footer={
        <>
          <Button className={styles.wide} leadingIcon={<LockIcon />} feedback={{ loading: 'Paying', success: 'Paid' }} animated={animated} onClick={() => onPay?.(total)}>Pay {money(total)}</Button>
          <p className={styles.legalText}>Encrypted payment</p>
        </>
      }
    >
      <h3 className={styles.title}>Order summary</h3>
      <div className={styles.product}>
        <span className={styles.tile}><BookmarkIcon size={20} /></span>
        <div className={styles.productText}><p className={styles.name}>{name}</p><p className={styles.small}>{detail}</p></div>
        <span className={styles.name}>{money(subtotal)}</span>
      </div>
      <form className={styles.promo} onSubmit={(event) => { void apply(event) }}>
        <Input size="sm" aria-label="Promo code" className={styles.mono} value={promo} invalid={rejected} onChange={(event) => { attempt.current += 1; setPromo(event.target.value); setApplied(false); setRejected(false) }} animated={animated} />
        <Button type="submit" variant="secondary" status={checking} loadingLabel="Checking" successLabel="Applied" onSuccessEnd={() => setChecking('idle')} animated={animated}>Apply</Button>
      </form>
      <hr className={styles.rule} />
      <dl className={styles.lines}>
        <div className={styles.line}><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
        <div className={styles.line}><dt>{discountLabel}</dt><dd data-good=""><RollingText value={applied ? `−${money(discount)}` : money(0)} still={still} /></dd></div>
        <div className={styles.line}><dt>Sales tax ({taxRate}%)</dt><dd><RollingText value={money(tax)} still={still} /></dd></div>
      </dl>
      <hr className={styles.rule} />
      <div className={styles.total}><span className={styles.name}>Total</span><strong><RollingText value={money(total)} still={still} /></strong></div>
    </Card>
  )
}

export type OnboardingStep = { title: string; description: string }

export type OnboardingCardProps = Base & {
  steps?: OnboardingStep[]
  illustration?: ReactNode
  onSkip?: () => void
  onDone?: () => void
}

const ONBOARDING: OnboardingStep[] = [
  { title: 'Create your first workspace', description: 'Each project gets one home. Start with Q4 planning and invite the team later.' },
  { title: 'Invite your team', description: 'Add people by email. They join with the access you pick.' },
  { title: 'Bring in your files', description: 'Drop in what you have. Everything stays searchable from one place.' },
]

/** An illustration, a progress pill, and Skip, Back and Next on the tray. */
export function OnboardingCard({ steps = ONBOARDING, illustration, onSkip, onDone, className, animated = true }: OnboardingCardProps) {
  const still = useStill(animated)
  const [[step, direction], setStep] = useState<[number, 1 | -1]>([0, 1])
  const current = steps[step]
  const last = step === steps.length - 1
  return (
    <Card
      className={cx(styles.pattern, className)}
      bodyClassName={styles.onboarding}
      footerClassName={styles.split}
      animated={animated}
      footer={
        <>
          <Button variant="ghost" animated={animated} onClick={onSkip}>Skip</Button>
          <div className={styles.nav}>
            <Button variant="secondary" disabled={step === 0} animated={animated} onClick={() => setStep([step - 1, -1])}>Back</Button>
            <Button trailingIcon={<ArrowRightIcon />} animated={animated} onClick={() => (last ? onDone?.() : setStep([step + 1, 1]))}>{last ? 'Done' : 'Next'}</Button>
          </div>
        </>
      }
    >
      <div className={styles.art}>
        {illustration ?? (
          <>
            <span className={styles.artTile} data-tone="amber"><FileTextIcon size={22} /></span>
            <span className={styles.artTile} data-tone="emerald"><FileValidationIcon size={22} /></span>
            <span className={styles.artTile} data-tone="red"><FileIcon size={22} /></span>
          </>
        )}
      </div>
      <div className={styles.window}>
        <Step stepKey={String(step)} direction={direction} still={still}>
          <h3 className={styles.titleLg}>{current?.title}</h3>
          <p className={styles.description22}>{current?.description}</p>
        </Step>
      </div>
      <div className={styles.progress} role="img" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((item, index) => <span key={item.title} data-on={index === step ? '' : undefined} />)}
      </div>
    </Card>
  )
}

export type StepperCardProps = Base & {
  steps?: { label: string; title: string; description: string; field: string; placeholder?: string; defaultValue?: string }[]
  onDone?: (values: string[]) => void
}

const STEPPER: NonNullable<StepperCardProps['steps']> = [
  { label: 'Project details', title: 'Project details', description: 'A little context helps the team find it later.', field: 'Project name', defaultValue: 'Arc launch' },
  { label: 'Assign owner', title: 'Assign owner', description: 'One person answers for it. You can change this later.', field: 'Owner email', placeholder: 'you@company.com' },
]

/** Numbered steps with one field each, and Back and Continue on the tray. */
export function StepperCard({ steps = STEPPER, onDone, className, animated = true }: StepperCardProps) {
  const still = useStill(animated)
  const [[step, direction], setStep] = useState<[number, 1 | -1]>([0, 1])
  const [values, setValues] = useState(() => steps.map((item) => item.defaultValue ?? ''))
  const current = steps[step]
  const last = step === steps.length - 1
  return (
    <Card
      className={cx(styles.pattern, className)}
      bodyClassName={styles.stepper}
      footerClassName={styles.split}
      animated={animated}
      footer={
        <>
          <span className={styles.stepCount}>Step {step + 1} of {steps.length}</span>
          <div className={styles.nav}>
            <Button variant="secondary" disabled={step === 0} animated={animated} onClick={() => setStep([step - 1, -1])}>Back</Button>
            <Button animated={animated} onClick={() => (last ? onDone?.(values) : setStep([step + 1, 1]))}>{last ? 'Finish' : 'Continue'}</Button>
          </div>
        </>
      }
    >
      <ol className={styles.steps}>
        {steps.map((item, index) => (
          <li key={item.label} className={styles.stepItem} data-on={index === step ? '' : undefined} data-done={index < step ? '' : undefined} aria-current={index === step ? 'step' : undefined}>
            <span className={styles.index}>{index < step ? <CheckIcon size={14} /> : index + 1}</span>
            <span className={styles.stepLabel}>{item.label}</span>
          </li>
        ))}
      </ol>
      <div className={styles.window}>
        <Step stepKey={String(step)} direction={direction} still={still}>
          <div className={styles.headingText}><h3 className={styles.title}>{current?.title}</h3><p className={styles.description22}>{current?.description}</p></div>
          <Field label={current?.field ?? ''} animated={animated}>
            <Input size="sm" placeholder={current?.placeholder} value={values[step] ?? ''} onChange={(event) => setValues(values.map((value, index) => (index === step ? event.target.value : value)))} animated={animated} />
          </Field>
        </Step>
      </div>
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
  onContinue?: () => void
}

/** A QR in avatar ink, and the key with a copy button. */
export function TwoFactorCard({ secret, stepLabel = 'Step 1 of 3', apps = ['Passkeep', 'Lockwell'], qr, onContinue, className, animated = true }: TwoFactorCardProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  function copy(): void {
    // Confirms only once the clipboard accepts it.
    void navigator.clipboard?.writeText(secret.replaceAll(' ', '')).then(() => {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    }, () => undefined)
  }
  return (
    <Card className={cx(styles.pattern, className)} bodyClassName={styles.twoFactor} footer={<Button feedback={{ loading: 'Verifying', success: 'Verified' }} animated={animated} onClick={onContinue}>Continue</Button>} animated={animated}>
      <div className={styles.twoFactorHead}><h3 className={styles.title}>Two-factor authentication</h3><Badge size="sm" mark={false} animated={animated}>{stepLabel}</Badge></div>
      <div className={styles.scan}>
        <div className={styles.qr}>{qr ?? <QrArt seed={secret} finderRadius={1.2} className={styles.qrArt} />}</div>
        <div className={styles.scanText}>
          <p className={styles.name}>Scan the QR code</p>
          <p className={styles.description22}>Open your authenticator app and scan this code to link your account.</p>
          <div className={styles.apps}>{apps.map((app) => <Badge key={app} size="sm" mark={false} animated={animated}>{app}</Badge>)}</div>
        </div>
      </div>
      <div className={styles.keyBlock}>
        <p className={styles.small}>Can’t scan it? Enter this key</p>
        <div className={styles.keyBox}>
          <code className={styles.key}>{secret}</code>
          <IconButton variant="ghost" size="sm" icon={copied ? <CheckIcon /> : <CopyIcon />} label={copied ? 'Copied' : 'Copy key'} animated={animated} onClick={copy} />
        </div>
      </div>
    </Card>
  )
}
