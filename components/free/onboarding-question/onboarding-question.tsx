'use client'
import { motion } from 'motion/react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { CompassIcon } from '@fetaui/react/rounded/compass'
import { DraftingCompassIcon } from '@fetaui/react/rounded/drafting-compass'
import { MegaphoneIcon } from '@fetaui/react/rounded/megaphone'
import { SourceCodeIcon } from '@fetaui/react/rounded/source-code'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Kbd, Meter, enter, kit, rowEnter } from '../product-kit/product-kit'
import styles from './onboarding-question.module.css'

export type OnboardingChoice = { value: string; label: string; description: string; icon: ReactNode }

/** A ready set for the common role question. */
export const ROLE_CHOICES: OnboardingChoice[] = [
  { value: 'engineering', label: 'Engineering', description: 'Ship features and review code', icon: <SourceCodeIcon size={16} /> },
  { value: 'design', label: 'Design', description: 'Specs, reviews and handoff', icon: <DraftingCompassIcon size={16} /> },
  { value: 'product', label: 'Product', description: 'Roadmaps and planning', icon: <CompassIcon size={16} /> },
  { value: 'marketing', label: 'Marketing', description: 'Launches and campaigns', icon: <MegaphoneIcon size={16} /> },
]

export type OnboardingQuestionProps = {
  question: string
  description?: string
  /** Default `ROLE_CHOICES`. */
  choices?: OnboardingChoice[]
  /** 1 based. */
  step: number
  steps: number
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onContinue?: (value: string) => void
  onSkip?: () => void
  animated?: boolean
  className?: string
}

/** One onboarding question: progress, Skip, choice cards with number keys, and Continue. */
export function OnboardingQuestion({ question, description, choices = ROLE_CHOICES, step, steps, value, defaultValue, onValueChange, onContinue, onSkip, animated = true, className }: OnboardingQuestionProps) {
  const still = useStill(animated)
  const uid = useId()
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held

  function choose(next: string): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const choice = choices[Number(e.key) - 1]
    if (choice && !e.metaKey && !e.ctrlKey) { e.preventDefault(); choose(choice.value) }
  }

  return (
    <motion.section {...enter(still)} className={cx(kit.tray, styles.tray, className)} aria-labelledby={uid}>
      <div className={cx(kit.body, styles.body)} onKeyDown={onKeyDown}>
        <Meter value={step} max={steps} label={`Question ${step} of ${steps}`} animated={animated} />
        <div className={styles.top}>
          <span className={kit.tertiary}>Question {step} of {steps}</span>
          {onSkip ? <Button variant="link" size="sm" animated={animated} onClick={onSkip}>Skip</Button> : null}
        </div>
        <h2 id={uid} className={styles.title}>{question}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
        <div role="radiogroup" aria-labelledby={uid} className={styles.choices}>
          {choices.map((choice, index) => (
            <motion.label key={choice.value} {...rowEnter(still, index)} className={styles.choice} data-on={current === choice.value ? '' : undefined}>
              <input type="radio" className={styles.input} name={uid} value={choice.value} checked={current === choice.value} onChange={() => choose(choice.value)} />
              <span className={styles.icon}>{choice.icon}</span>
              <span className={styles.text}><span className={styles.label}>{choice.label}</span><span className={styles.sub}>{choice.description}</span></span>
              <span className={styles.key}><Kbd outline animated={animated}>{index + 1}</Kbd></span>
            </motion.label>
          ))}
        </div>
        <footer className={styles.footer}>
          <Button shape="pill" animated={animated} trailingIcon={<ChevronRightIcon size={14} />} disabled={!current} onClick={() => { if (current) onContinue?.(current) }}>Continue</Button>
        </footer>
      </div>
    </motion.section>
  )
}
