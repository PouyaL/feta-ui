'use client'
import NumberFlow, { type Format } from '@number-flow/react'

// Kept apart from motion-kit: number-flow registers a custom element when it loads, so only components that show a FlowNumber pay for it.

/** A number whose digits flow to each new value. Still, or with reduced motion, it changes at once. */
export function FlowNumber({ value, still = false, format, prefix, suffix, locales, className }: {
  value: number
  still?: boolean
  format?: Format
  prefix?: string
  suffix?: string
  locales?: Intl.LocalesArgument
  className?: string | undefined
}) {
  return (
    <NumberFlow
      value={value}
      animated={!still}
      respectMotionPreference
      {...(format ? { format } : {})}
      {...(prefix ? { prefix } : {})}
      {...(suffix ? { suffix } : {})}
      {...(locales ? { locales } : {})}
      {...(className ? { className } : {})}
    />
  )
}
