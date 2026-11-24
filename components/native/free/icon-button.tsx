import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { Button, HEIGHT, type ButtonProps } from './button'

export type IconButtonProps = Omit<ButtonProps, 'variant' | 'shape' | 'children' | 'leadingIcon' | 'trailingIcon' | 'loadingLabel' | 'successLabel' | 'accessibilityLabel'> & {
  /** Default `primary`. Icon Button has no Link variant. */
  variant?: Exclude<NonNullable<ButtonProps['variant']>, 'link'>
  icon: ReactNode
  /** The accessible name. There is no visible label, so this is required. */
  label: string
}

/** The round sibling of Button: same variants, sizes, states and press motion. */
export function IconButton({ icon, label, size = 'md', contentStyle, ...rest }: IconButtonProps) {
  return <Button {...rest} size={size} shape="pill" leadingIcon={icon} accessibilityLabel={label} contentStyle={[styles[size], contentStyle]} />
}

const styles = StyleSheet.create({
  sm: { gap: 0, paddingHorizontal: 0, width: HEIGHT.sm },
  md: { gap: 0, paddingHorizontal: 0, width: HEIGHT.md },
  lg: { gap: 0, paddingHorizontal: 0, width: HEIGHT.lg },
})
