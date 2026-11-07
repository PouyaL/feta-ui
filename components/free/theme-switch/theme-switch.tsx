'use client'
import { motion } from 'motion/react'
import { useState, type MouseEvent } from 'react'
import { MoonIcon } from '@fetaui/react/rounded/moon'
import { SunIcon } from '@fetaui/react/rounded/sun'
import { duration, ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { LabelSwap, useStill } from '../motion-kit/motion-kit'
import { spread, type ThemeValue } from '../theme-toggle/theme-toggle'

export type ThemeSwitchProps = {
  /** `icon` is the circle Icon Button, `label` a pill Button with a label. */
  kind?: 'icon' | 'label'
  value?: ThemeValue
  defaultValue?: ThemeValue
  /** Apply the theme here. It runs inside the view transition. */
  onValueChange?: (value: ThemeValue) => void
  disabled?: boolean
  animated?: boolean
  className?: string
}

/** Switches the app between light and dark. The sun folds into the moon as the theme spreads. */
export function ThemeSwitch({ kind = 'icon', value, defaultValue = 'light', onValueChange, disabled, animated = true, className }: ThemeSwitchProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState<ThemeValue>(defaultValue)
  const current = value ?? held
  const dark = current === 'dark'
  const next: ThemeValue = dark ? 'light' : 'dark'

  function toggle(e: MouseEvent<HTMLButtonElement>): void {
    const change = (): void => { setHeld(next); onValueChange?.(next) }
    if (still || typeof document.startViewTransition !== 'function') { change(); return }
    const box = e.currentTarget.getBoundingClientRect()
    spread(change, box.left + box.width / 2, box.top + box.height / 2)
  }

  const glyph = (
    <motion.span key={current} style={{ display: 'inline-flex' }} initial={still ? false : { rotate: -90, scale: 0.8, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: still ? 0 : duration.slow, ease: ease.out }}>
      {dark ? <MoonIcon trigger="none" /> : <SunIcon trigger="none" />}
    </motion.span>
  )

  if (kind === 'label') {
    return (
      <Button variant="secondary" shape="pill" animated={animated} disabled={disabled ?? false} leadingIcon={glyph} aria-label={`Switch to ${next} theme`} {...(className ? { className } : {})} onClick={toggle}>
        <LabelSwap swapKey={current} still={still}>{dark ? 'Dark' : 'Light'}</LabelSwap>
      </Button>
    )
  }
  return <IconButton variant="secondary" animated={animated} disabled={disabled ?? false} label={`Switch to ${next} theme`} icon={glyph} {...(className ? { className } : {})} onClick={toggle} />
}
