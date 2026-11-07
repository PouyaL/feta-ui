'use client'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { ImageIcon } from '@fetaui/react/rounded/image'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { UploadIcon } from '@fetaui/react/rounded/upload'
import { ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './aspect-ratio.module.css'

const REVEAL_S = 0.32
const REVEAL_REDUCED_S = 0.12
const REVEAL_EASE = ease['out-soft']
const ERROR_FADE_S = 0.2

/** The `accept` rules, for files that skip the picker, like a drop. */
const accepts = (file: File, accept: string): boolean => accept.split(',').some((part) => {
  const rule = part.trim().toLowerCase()
  if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule)
  return rule.endsWith('/*') ? file.type.startsWith(rule.slice(0, -1)) : file.type === rule
})

export type AspectRatioValue = '1:1' | '4:3' | '3:2' | '16:9' | '21:9' | '9:16'

export type AspectRatioProps = {
  /** Picked from the content, not the container. Default `16:9`. */
  ratio?: AspectRatioValue
  /** An image to load. Shows Loading until it decodes, then Error if it fails. */
  src?: string
  /** Required with `src`. Use an empty string for a decorative image. */
  alt?: string
  /** Forces a state. Without it, the state follows `src`, `children` and the load. */
  content?: 'image' | 'video' | 'loading' | 'empty' | 'error'
  /** Your own media, such as a video element or a drawn scene. */
  children?: ReactNode
  /** Visible text under the frame. Alt text is for screen readers. */
  caption?: ReactNode
  /** Video: the time on the chip, like `2:14`. */
  duration?: string
  onPlay?: () => void
  /** Empty: a file was picked or dropped. */
  onFile?: (file: File) => void
  /** Empty: the Upload button shows Button Loading while this is true. */
  uploading?: boolean
  accept?: string
  emptyTitle?: string
  emptyHint?: string
  errorTitle?: string
  errorHint?: string
  /** Error: Retry returns to Loading. */
  onRetry?: () => void
  /** `false` keeps the shimmer and the reveal still. */
  animated?: boolean
  className?: string
}

/** Holds media at a fixed ratio, so layouts never jump while it loads. */
export function AspectRatio({
  ratio = '16:9', src, alt = '', content, children, caption, duration, onPlay, onFile, uploading = false, accept = 'image/png,image/jpeg',
  emptyTitle = 'Drop an image', emptyHint, errorTitle = 'Couldn’t load image', errorHint = 'Check the link and try again', onRetry, animated = true, className,
}: AspectRatioProps) {
  const still = useStill(animated)
  const input = useRef<HTMLInputElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const [load, setLoad] = useState<{ src: string; state: 'ready' | 'failed' } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState(false)
  const known = load?.src === src ? load?.state ?? null : null
  const state = content ?? (src ? (known === 'failed' ? 'error' : known === 'ready' ? 'image' : 'loading') : children ? 'image' : 'empty')
  const [width, height] = ratio.split(':').map(Number)

  // A cached image finishes before React attaches its handlers.
  useEffect(() => {
    const node = image.current
    if (node?.complete && src) setLoad({ src, state: node.naturalWidth > 0 ? 'ready' : 'failed' })
  }, [src, attempt])

  function retry(): void {
    setLoad(null)
    setAttempt((value) => value + 1)
    onRetry?.()
  }

  function take(file: File): void {
    const fits = accepts(file, accept)
    setRejected(!fits)
    if (fits) onFile?.(file)
  }

  function drop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) take(file)
  }

  function pick(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (file) take(file)
    e.target.value = ''
  }

  const showImage = Boolean(src) && (state === 'image' || state === 'loading')

  return (
    <figure className={cx(styles.root, className)}>
      <div
        className={styles.frame}
        data-state={state}
        data-over={over ? '' : undefined}
        data-still={still ? '' : undefined}
        aria-busy={state === 'loading' || undefined}
        style={{ '--ratio': `${width} / ${height}` } as CSSProperties}
        {...(state === 'empty' ? { onDragOver: (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setOver(true) }, onDragLeave: () => setOver(false), onDrop: drop } : {})}
      >
        {showImage && src ? (
          <motion.img
            key={`${src}-${attempt}`}
            ref={image}
            src={src}
            alt={alt}
            className={styles.media}
            initial={still ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)', scale: 1.02 }}
            animate={state === 'image' ? { opacity: 1, filter: 'blur(0px)', scale: 1 } : still ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)', scale: 1.02 }}
            transition={{ duration: animated ? (still ? REVEAL_REDUCED_S : REVEAL_S) : 0, ease: REVEAL_EASE }}
            onLoad={() => { if (src) setLoad({ src, state: 'ready' }) }}
            onError={() => { if (src) setLoad({ src, state: 'failed' }) }}
          />
        ) : null}
        {!src && (state === 'image' || state === 'video' || state === 'loading') ? <div className={styles.media} data-hidden={state === 'loading' ? '' : undefined}>{children}</div> : null}

        {state === 'loading' ? <span ref={watchOffscreen} aria-hidden="true" className={styles.loading} data-loop=""><span className={styles.shimmer} /><span className={styles.loadingIcon}><ImageIcon /></span></span> : null}

        {state === 'video' ? (
          <>
            <span aria-hidden="true" className={styles.scrim} />
            <span className={styles.play}>
              <Button variant="outline" shape="pill" size="lg" animated={animated} aria-label={duration ? `Play video, ${duration}` : 'Play video'} className={styles.playButton} leadingIcon={<span aria-hidden="true" className={styles.playGlyph} />} onClick={onPlay} />
            </span>
            {duration ? <span className={styles.chip}>{duration}</span> : null}
          </>
        ) : null}

        {state === 'empty' ? (
          <div className={styles.message}>
            <svg aria-hidden="true" className={styles.dash} width="100%" height="100%"><rect x="0.5" y="0.5" width="100%" height="100%" rx="17.5" /></svg>
            <span className={styles.messageIcon}><ImageIcon /></span>
            <span className={styles.title}>{emptyTitle}</span>
            <span className={styles.hint} role={rejected ? 'alert' : undefined}>{rejected ? 'That file type isn’t supported' : emptyHint ?? `PNG or JPG · ${ratio}`}</span>
            <input ref={input} type="file" accept={accept} className={styles.file} tabIndex={-1} aria-hidden="true" onChange={pick} />
            <Button variant="secondary" size="sm" animated={animated} status={uploading ? 'loading' : 'idle'} leadingIcon={<UploadIcon />} onClick={() => input.current?.click()}>Upload</Button>
          </div>
        ) : null}

        {state === 'error' ? (
          <motion.div role="alert" className={styles.message} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: still ? 0 : ERROR_FADE_S, ease: REVEAL_EASE }}>
            <span className={styles.messageIcon} data-danger=""><AlertCircleIcon /></span>
            <span className={styles.title}>{errorTitle}</span>
            <span className={styles.hint}>{errorHint}</span>
            <Button variant="secondary" size="sm" animated={animated} leadingIcon={<RefreshCwIcon />} onClick={retry}>Retry</Button>
          </motion.div>
        ) : null}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  )
}

/** The drawn stand-in from the Figma frames, built from gradient tokens. Replace it with real media. */
export function AspectRatioScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cx(styles.scene, className)}>
      <rect width="320" height="180" className={styles.sky} />
      <circle cx="226" cy="74" r="26" className={styles.sun} />
      <path d="M0 118C60 88 108 96 168 122S280 142 320 112V180H0Z" className={styles.dune} />
      <path d="M0 152C54 124 132 128 188 146S288 166 320 148V180H0Z" className={styles.duneNear} />
    </svg>
  )
}
