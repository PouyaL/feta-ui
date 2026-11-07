'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, type ComponentProps, type MouseEventHandler, type ReactNode } from 'react'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { spring } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Skeleton } from '../skeleton/skeleton'
import styles from './card.module.css'

export type CardProps = Omit<ComponentProps<'article'>, 'title' | 'onClick'> & {
  /** `tray` is the inset card on the 4% tray. `plain` is the inset card alone. `muted` is a 5% panel. Default `tray`. */
  variant?: 'tray' | 'plain' | 'muted'
  /** Rendered as `li` inside a list. Default `article`. */
  as?: 'article' | 'li'
  /** Heading level of `title`. Default 3. */
  headingLevel?: 2 | 3 | 4
  title?: ReactNode
  description?: ReactNode
  /** One item per piece of meta text. Separated by a dot. */
  meta?: ReactNode[]
  /** Usually `<CardMedia />` or an image, 140 px tall. */
  media?: ReactNode
  /** Usually a Ghost, Small Icon Button. */
  headerAction?: ReactNode
  /** Sits on the tray, or below a divider on `plain` and `muted`. */
  footer?: ReactNode
  /** Makes the whole card a link, through a link on the title stretched over it. */
  href?: string
  /** Makes the whole card a button, through a button on the title stretched over it. */
  onPress?: MouseEventHandler<HTMLButtonElement>
  /** With `onPress` this sets `aria-pressed`. Adds the ring and the check. */
  selected?: boolean
  /** Content at 50% and Buttons disabled. */
  disabled?: boolean
  /** Skeletons hold the exact height, and the content fades in when this turns false. */
  loading?: boolean
  /** Added to the inset card, so a composition can set its own padding and gap. */
  bodyClassName?: string | undefined
  footerClassName?: string | undefined
  /** `false` turns off lift, press and the check pop. */
  animated?: boolean
}

/** The container most of FetaUI is built on: an inset card on a tray, with actions on the tray. */
export function Card({
  variant = 'tray', as = 'article', headingLevel = 3, title, description, meta, media, headerAction, footer, href, onPress, selected = false, disabled = false, loading = false,
  bodyClassName, footerClassName, animated = true, className, children, ...rest
}: CardProps) {
  const Tag = as as 'article'
  const still = useStill(animated)
  const titleId = useId()
  const Heading = `h${headingLevel}` as const
  const clickable = (Boolean(href) || Boolean(onPress)) && !disabled && !loading
  const headed = Boolean(title || description || headerAction)
  const name = !clickable ? title
    : href ? <a className={styles.stretch} href={href}>{title}</a>
    : <button type="button" className={styles.stretch} aria-pressed={selected} onClick={onPress}>{title}</button>

  const content = (
    <>
      {media ? <div className={styles.media}>{media}</div> : null}
      {headed ? (
        <div className={styles.header}>
          <div className={styles.text}>
            {title ? <Heading id={titleId} className={styles.title}>{name}</Heading> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {headerAction ? <fieldset className={styles.group} disabled={disabled || loading}>{headerAction}</fieldset> : null}
        </div>
      ) : null}
      {meta?.length ? (
        <p className={styles.meta}>
          {meta.map((item, index) => <span key={index} className={styles.metaItem}>{item}</span>)}
        </p>
      ) : null}
      {children}
    </>
  )

  const body = (
    <div className={cx(styles.body, bodyClassName)}>
      <div className={styles.content} inert={loading || undefined}>{content}</div>
      {loading ? (
        <div className={styles.skeleton} aria-hidden="true">
          {media ? <Skeleton shape="block" height={140} className={styles.boneMedia} shimmer={false} /> : null}
          <Skeleton width="55%" height={14} shimmer={false} />
          <Skeleton width="85%" height={10} shimmer={false} />
          {meta?.length ? <Skeleton width="40%" height={10} className={styles.boneMeta} shimmer={false} /> : null}
        </div>
      ) : null}
    </div>
  )

  return (
    <Tag
      {...rest}
      className={cx(styles.card, className)}
      data-variant={variant}
      data-clickable={clickable ? '' : undefined}
      data-selected={selected ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-loading={loading ? '' : undefined}
      data-still={still ? '' : undefined}
      aria-busy={loading || undefined}
      aria-labelledby={title ? titleId : rest['aria-labelledby']}
    >
      {body}
      {footer ? <fieldset className={cx(styles.group, styles.footer, footerClassName)} disabled={disabled}>{footer}</fieldset> : null}
      <AnimatePresence initial={false}>
        {selected ? (
          <motion.span key="check" className={styles.check} initial={still ? false : { scale: 0 }} animate={{ scale: 1 }} exit={still ? { opacity: 0 } : { scale: 0 }} transition={still ? { duration: 0 } : spring.pop}>
            <CheckIcon size={14} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Tag>
  )
}

/** The placeholder scene. Replace it with an image. */
export function CardMedia({ className }: { className?: string }) {
  return (
    <span className={cx(styles.scene, className)} aria-hidden="true">
      <span className={styles.sun} />
      <span className={styles.hillBack} />
      <span className={styles.hillFront} />
    </span>
  )
}
