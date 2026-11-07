'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { ArrowLeftIcon } from '@fetaui/react/rounded/arrow-left'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { RotateCcwIcon } from '@fetaui/react/rounded/rotate-ccw'
import { XIcon } from '@fetaui/react/rounded/x'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { IconButton } from '../icon-button/icon-button'
import { Input } from '../input/input'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Radio } from '../radio/radio'
import { ease } from '../../motion-tokens'
import { Kbd, MotionLabel } from '../product-kit/product-kit'
import styles from './questionnaire.module.css'

/** Motion from the Questionnaire Motion frame. */
const STEP_NEXT = { type: 'spring', duration: 0.28, bounce: 0.3 } as const
const STEP_BACK = { type: 'spring', duration: 0.24, bounce: 0.3 } as const
const ERROR_S = 0.2
const KEY_PRESS_MS = 80

export type QuestionnaireChoiceProps = {
  mode?: 'single' | 'multiple'
  label: ReactNode
  description?: ReactNode
  shortcut?: string | undefined
  /** Lit while its key is held. */
  keyPressed?: boolean
  name?: string
  value?: string
  checked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Forces a pose for previews. */
  state?: 'hover' | 'focus'
  animated?: boolean
  className?: string
  ref?: Ref<HTMLLabelElement>
}

/** One answer row: Radio or Checkbox, a label and an optional key. */
export function QuestionnaireChoice({ mode = 'single', label, description, shortcut, keyPressed, name, value, checked = false, disabled, onCheckedChange, state, animated = true, className, ref }: QuestionnaireChoiceProps) {
  const onRadio = (e: ChangeEvent<HTMLInputElement>): void => onCheckedChange?.(e.target.checked)
  return (
    <label ref={ref} className={cx(styles.choice, className)} data-selected={checked ? '' : undefined} data-disabled={disabled ? '' : undefined} data-state={state}>
      {mode === 'single'
        ? <Radio {...(name ? { name } : {})} {...(value ? { value } : {})} checked={checked} disabled={disabled ?? false} animated={animated} onChange={onRadio} />
        : <Checkbox {...(name ? { name } : {})} {...(value ? { value } : {})} checked={checked} disabled={disabled ?? false} animated={animated} onCheckedChange={(next) => onCheckedChange?.(next)} />}
      <span className={styles.choiceText}>
        <span className={styles.choiceLabel}>{label}</span>
        {description ? <span className={styles.choiceDescription}>{description}</span> : null}
      </span>
      {shortcut ? <span className={styles.shortcut}><Kbd pressed={keyPressed ?? false} outline={checked} animated={animated}>{shortcut}</Kbd></span> : null}
    </label>
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
  /** Number or letter keys on the choices. `switch` adds a tray toggle between them. */
  shortcuts?: 'letters' | 'numbers' | 'switch'
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
  animated?: boolean
  className?: string
}

const answered = (question: Question | undefined, answer: QuestionnaireAnswer | undefined): boolean =>
  Boolean(question && answer && (answer.values.length > 0 || (answer.text ?? '').trim()))

/** Step pills. The current one stretches, drawn with transforms so nothing reflows. */
function Pills({ count, at }: { count: number; at: number }) {
  let x = 0
  return (
    <span className={styles.pills} style={{ width: 16 + (count - 1) * 10 }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const now = i === at
        const left = x
        x += (now ? 16 : 6) + 4
        return <i key={i} className={styles.pill} data-state={now ? 'now' : i < at ? 'done' : 'next'} style={{ transform: `translateX(${left}px) scaleX(${now ? 1 : 6 / 16})` }} />
      })}
    </span>
  )
}

/** Asks one question at a time, single or multiple, with shortcuts, validation and restore. */
export function Questionnaire({ questions, header = 'steps', title, value, defaultValue = {}, onValueChange, step, defaultStep = 0, onStepChange, hostLabel, shortcuts, validation = 'lock', errorMessage = 'Choose an answer to continue.', foldAnswers, restored, onCancel, onComplete, nextLabel = 'Next', submitLabel, backLabel = 'Back', hint, animated = true, className }: QuestionnaireProps) {
  const still = useStill(animated)
  const uid = useId()
  const [held, setHeld] = useState(defaultValue)
  const [heldStep, setHeldStep] = useState(defaultStep)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState(false)
  const [keys, setKeys] = useState<'letters' | 'numbers'>(shortcuts === 'numbers' ? 'numbers' : 'letters')
  const [pressed, setPressed] = useState<string | null>(null)
  const [wasRestored, setWasRestored] = useState(Boolean(restored))
  const answers = value ?? held
  const flow = useMemo(() => questions.filter((question) => !question.when || question.when(answers)), [questions, answers])
  const index = Math.min(step ?? heldStep, flow.length - 1)
  const question = flow[index]
  const previous = flow[index - 1]
  const title_ = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const answer = question ? answers[question.id] : undefined
  const valid = !question || Boolean(question.optional) || answered(question, answer)
  const last = index === flow.length - 1
  const selected = answer?.values.length ?? 0
  const mode = question?.mode ?? 'single'
  const useKeys = Boolean(shortcuts)

  useEffect(() => {
    if (moved.current) title_.current?.focus({ preventScroll: true })
    moved.current = false
  }, [index])

  useEffect(() => () => clearTimeout(pressTimer.current), [])

  function setAnswers(next: QuestionnaireAnswers): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function goTo(next: number): void {
    moved.current = true
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

  const keyFor = (i: number): string | undefined => (!useKeys ? undefined : keys === 'numbers' ? String(i + 1) : String.fromCharCode(65 + i))

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (!useKeys || !question || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLInputElement && e.target.type === 'text')) return
    if (e.key === 'Enter') { e.preventDefault(); next(); return }
    const at = keys === 'numbers' ? Number(e.key) - 1 : e.key.toUpperCase().charCodeAt(0) - 65
    const choice = e.key.length === 1 ? question.choices[at] : undefined
    if (!choice || choice.disabled) return
    e.preventDefault()
    pick(choice, !(answer?.values.includes(choice.value) ?? false))
    setPressed(choice.value)
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPressed(null), still ? 0 : KEY_PRESS_MS)
  }

  const counter = `Question ${index + 1} of ${flow.length}`
  const swap = still ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } } : {
    initial: { opacity: 0, y: 12 * direction }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 * direction }, transition: direction > 0 ? STEP_NEXT : STEP_BACK,
  }
  const steps = <span className={styles.count}><Pills count={flow.length} at={index} /><span className={styles.mono}>{counter}</span></span>
  const foldedInBody = foldAnswers && header === 'steps'
  const previousAnswer = previous ? answers[previous.id] : undefined
  const previousText = previous?.choices.filter((choice) => previousAnswer?.values.includes(choice.value)).map((choice) => choice.label).join(', ')

  return (
    <section className={cx(styles.shell, className)} aria-label={title ?? 'Questionnaire'} data-still={still ? '' : undefined}>
      <header className={styles.header}>
        {foldedInBody && previous ? (
          <motion.span key={previous.id} className={styles.answered} initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: still ? 0 : 0.28, ease: ease.out }}>
            <span className={styles.mark}><CheckIcon size={10} /></span>
            <span className={styles.answeredQuestion}>{previous.title}</span>
            <span className={styles.answeredValue}>{previousText}</span>
          </motion.span>
        ) : header === 'select' ? <span className={styles.mono}>{mode === 'multiple' ? 'Select all that apply' : counter}</span>
          : header === 'card' ? <h3 className={styles.cardTitle}>{title}</h3>
            : header === 'progress' ? (
              <span className={styles.checkpoints}>
                <span className={styles.checkpointRow}><span className={styles.mono}>Checkpoint {index + 1} of {flow.length}</span><span className={styles.checkpointName}>{question?.checkpoint}</span></span>
                <span className={styles.bar} aria-hidden="true">{flow.map((entry, i) => <i key={entry.id} data-on={i <= index ? '' : undefined} />)}</span>
              </span>
            ) : header === 'count' ? <span className={styles.mono}>Step {index + 1}/{flow.length}</span> : steps}
        <span className={styles.headerEnd}>
          {header === 'select' && mode === 'multiple' ? <span className={styles.selected}><b>{selected}</b> selected</span> : null}
          {header === 'card' ? <span className={styles.ratio}>{index + 1} / {flow.length}</span> : null}
          {question?.tag ? <span className={styles.mono}>{question.tag}</span> : null}
          {hostLabel ? <span className={styles.host}><i aria-hidden="true" />{hostLabel}</span> : null}
          {wasRestored ? <span className={styles.restored}><RotateCcwIcon size={14} /><span className={styles.mono}>Restored</span></span> : null}
          {error && validation === 'report' ? <span className={styles.issue}><span className={styles.issueBadge} aria-hidden="true">!</span>1 issue</span> : null}
          {shortcuts === 'switch' ? (
            <span role="radiogroup" aria-label="Shortcut keys" className={styles.keys}>
              {(['letters', 'numbers'] as const).map((kind) => <button key={kind} type="button" role="radio" aria-checked={keys === kind} className={styles.keysOption} onClick={() => setKeys(kind)}><MotionLabel text={kind === 'letters' ? 'Letters' : 'Numbers'} still={still} /></button>)}
            </span>
          ) : null}
          {onCancel ? <IconButton variant="ghost" size="sm" animated={animated} label="Close" icon={<XIcon size={16} />} onClick={onCancel} /> : null}
        </span>
      </header>

      <div className={styles.card} onKeyDown={onKeyDown}>
        <AnimatePresence mode="popLayout" initial={false}>
          {question ? (
            <motion.div key={question.id} className={styles.step} {...swap}>
              {foldedInBody ? steps : null}
              <div className={styles.heading}>
                <h2 ref={title_} tabIndex={-1} id={`${uid}-${question.id}`} className={styles.title}>{question.title}</h2>
                {question.description ? <p className={styles.description}>{question.description}</p> : null}
              </div>
              <div role={mode === 'single' ? 'radiogroup' : 'group'} aria-labelledby={`${uid}-${question.id}`} aria-required={!question.optional} aria-invalid={error || undefined} aria-describedby={error ? `${uid}-error` : undefined} className={styles.choices}>
                {question.choices.map((choice, i) => (
                  <QuestionnaireChoice
                    key={choice.value}
                    mode={mode}
                    name={`${uid}-${question.id}`}
                    value={choice.value}
                    label={choice.label}
                    {...(choice.description ? { description: choice.description } : {})}
                    {...(keyFor(i) ? { shortcut: keyFor(i) } : {})}
                    keyPressed={pressed === choice.value}
                    checked={answer?.values.includes(choice.value) ?? false}
                    disabled={choice.disabled ?? false}
                    animated={animated}
                    onCheckedChange={(on) => pick(choice, on)}
                  />
                ))}
              </div>
              {question.freeform ? (
                <div className={styles.freeform}>
                  <span className={styles.or}><span className={styles.mono}>Or write your own</span></span>
                  <Input value={answer?.text ?? ''} placeholder={question.freeform} aria-label={question.freeform} animated={animated} onChange={(e) => { setError(false); setAnswers({ ...answers, [question.id]: { values: answer?.values ?? [], text: e.target.value } }) }} />
                </div>
              ) : null}
              <AnimatePresence initial={false}>
                {error ? (
                  <motion.p key="error" id={`${uid}-error`} role="alert" className={styles.error} initial={still ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }} transition={{ duration: still ? 0 : ERROR_S, ease: ease.out }}>
                    <AlertCircleIcon size={16} />{errorMessage}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <footer className={styles.footer}>
        <span className={styles.footerStart}>
          {onCancel ? <Button variant="ghost" size="sm" shape="pill" animated={animated} onClick={onCancel}>Cancel</Button>
            : index > 0 && !foldAnswers ? <Button variant="ghost" size="sm" shape="pill" animated={animated} leadingIcon={<ArrowLeftIcon size={14} />} onClick={() => goTo(index - 1)}>{backLabel}</Button>
              : shortcuts ? <span className={styles.hint}>Press <Kbd outline>↵</Kbd> to confirm</span>
                : question?.optional ? <Button variant="link" size="sm" animated={animated} onClick={() => { if (last) onComplete?.(answers); else goTo(index + 1) }}>Skip for now</Button>
                  : <span className={styles.hint}>{question?.hint ?? hint}</span>}
        </span>
        <span className={styles.actions}>
          {restored && wasRestored ? <Button variant="secondary" size="sm" shape="pill" animated={animated} onClick={() => { setAnswers({}); setWasRestored(false) }}>Reset</Button> : null}
          <Button size="sm" shape="pill" animated={animated} trailingIcon={last && submitLabel ? undefined : <ArrowRightIcon size={14} />} disabled={validation === 'lock' && !valid} {...(last && submitLabel ? { feedback: { loading: 'Sending', success: 'Sent' } } : {})} onClick={next}>{last && submitLabel ? submitLabel : nextLabel}</Button>
        </span>
      </footer>
    </section>
  )
}

/** Questionnaire in a modal. The native dialog traps focus, closes on Escape and returns focus. */
export function QuestionnaireDialog({ open, onClose, ...rest }: Omit<QuestionnaireProps, 'onCancel'> & { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  return (
    <dialog ref={dialog} className={styles.dialog} aria-label="Questionnaire" onClose={onClose}>
      {open ? <Questionnaire {...rest} onCancel={onClose} /> : null}
    </dialog>
  )
}
