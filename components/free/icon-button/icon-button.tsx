'use client'
import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '../button/button'
import styles from './icon-button.module.css'

export type IconButtonProps = Omit<ButtonProps, 'variant' | 'shape' | 'children' | 'leadingIcon' | 'trailingIcon' | 'shortcut' | 'loadingLabel' | 'successLabel'> & {
  /** Default `primary`. Icon Button has no Link variant. */
  variant?: Exclude<NonNullable<ButtonProps['variant']>, 'link'>
  icon: ReactNode
  /** The accessible name. There is no visible label, so this is required. */
  label: string
}

/** The round sibling of Button: same variants, sizes, states and press motion. */
export function IconButton({ icon, label, className, ...rest }: IconButtonProps) {
  return <Button {...rest} shape="pill" leadingIcon={icon} aria-label={label} className={[styles.iconButton, className].filter(Boolean).join(' ')} />
}
