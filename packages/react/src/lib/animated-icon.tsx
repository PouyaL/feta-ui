'use client'
import { useContext, useEffect, useId, useImperativeHandle, useMemo, useRef, type CSSProperties } from 'react'
import { flickerNeon } from './play'
import { AnimatedIconsContext } from './provider'
import type { IconProps, Style } from './types'
import { useIconAnimation } from './use-icon-animation'

type Props = IconProps & {
  /** Icon name, for development warnings. */
  icon: string
  iconStyle: Style
  /** Inner SVG markup, our own generated output. */
  body: string
  dir: 1 | -1
}

/**
 * The shared client component behind every generated icon (ANIMATION.md §5, §6.1). Generated files
 * stay thin wrappers with no hooks, so plain prop usage works inside Server Components.
 */
export function AnimatedIcon({ icon, iconStyle, body, dir, size = 24, color, trigger = 'hover', preset = 'draw', speed = 1, ref, style, 'aria-label': label, ...rest }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  // The same icon can render twice on a page; each copy gets its own gradient and filter ids.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const html = useMemo(() => body.replace(/(id="|url\(#|href="#)feta-/g, `$1feta-${uid}-`), [body, uid])
  const animated = useContext(AnimatedIconsContext)
  const handle = useIconAnimation(svg, { preset, style: iconStyle, dir, speed, trigger: animated ? trigger : 'none', name: icon })
  useImperativeHandle(ref, () => handle, [handle])

  useEffect(() => {
    if (iconStyle === 'neon' && svg.current) flickerNeon(svg.current)
  }, [iconStyle])

  const ink: CSSProperties = color ? (iconStyle === 'neon' ? ({ '--feta-neon-glow': color } as CSSProperties) : { color }) : {}
  return (
    <svg
      ref={svg}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      overflow="visible"
      style={{ ...ink, ...style }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
