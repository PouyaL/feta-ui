'use client'
import { ArrowUpRightIcon } from '@fetaui/react/rounded/arrow-up-right'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { Children, Fragment, type CSSProperties, type HTMLAttributes, type MouseEventHandler, type ReactNode, type Ref } from 'react'
import { cx } from '../motion-kit/motion-kit'
import { useStill } from '../motion-kit/use-still'
import { Separator } from '../separator/separator'
import styles from './item.module.css'

export type ItemProps = Omit<HTMLAttributes<HTMLElement>, 'title' | 'onClick' | 'ref'> & {
  /** Default has no surface until hover, Outline sits on surface, Muted on the tray. */
  variant?: 'default' | 'outline' | 'muted'
  /** Default `md`. */
  size?: 'md' | 'sm' | 'xs'
  /** Icon tile, Avatar or art. */
  media?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** One Button or Icon Button. Only the action is the target. */
  action?: ReactNode
  /** A mono meta value, or anything else at the end of the row. */
  meta?: ReactNode
  /** The whole row becomes a link, ending in a chevron. */
  href?: string
  /** `false` hides the trailing chevron, for long menus of links. */
  chevron?: boolean
  /** Leaves the app: a new tab, and an arrow instead of the chevron. */
  external?: boolean
  /** The whole row becomes a button. */
  onClick?: MouseEventHandler<HTMLElement>
  /** Keeps the wash, like the track now playing. */
  active?: boolean
  disabled?: boolean
  animated?: boolean
  ref?: Ref<HTMLElement>
}

/** A row that shows one thing: media, title, description and at most one action. */
export function Item({
  variant = 'default', size = 'md', media, title, description, action, meta, href, chevron = true, external = false, onClick,
  active = false, disabled = false, animated = true, className, ref, ...rest
}: ItemProps) {
  const still = useStill(animated)
  const shared = {
    'data-variant': variant, 'data-size': size,
    'data-active': active ? '' : undefined,
    'data-disabled': disabled ? '' : undefined,
    'data-still': still ? '' : undefined,
    'data-target': (href || onClick) && !disabled ? '' : undefined,
    className: cx(styles.item, className),
    ...rest,
  }
  const body = (
    <>
      {media ? <span className={styles.media}>{media}</span> : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {action ? <span className={styles.action}>{action}</span> : null}
      {href && chevron ? <span className={styles.trailing} data-external={external ? '' : undefined}>{external ? <ArrowUpRightIcon size={16} /> : <ChevronRightIcon size={16} />}</span> : null}
    </>
  )
  if (href && !disabled) {
    return <a ref={ref as Ref<HTMLAnchorElement>} href={href} onClick={onClick} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} {...shared}>{body}</a>
  }
  if (onClick) {
    return <button ref={ref as Ref<HTMLButtonElement>} type="button" disabled={disabled} onClick={onClick} {...shared}>{body}</button>
  }
  return <div ref={ref as Ref<HTMLDivElement>} {...shared}>{body}</div>
}

export type ItemTileProps = HTMLAttributes<HTMLSpanElement> & {
  /** Matches the Item. Default `md`. */
  size?: ItemProps['size']
  /** Tints the tile for a status, with a token like `var(--feta-status-warning)`. */
  tone?: string
}

/** The square behind an icon. */
export function ItemTile({ size = 'md', tone, className, style, children, ...rest }: ItemTileProps) {
  return <span data-size={size} className={cx(styles.tile, className)} style={{ ...(tone ? { '--tile-tone': tone } : {}), ...style } as CSSProperties} {...rest}>{children}</span>
}

export type ItemGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** Mono header on the tray. */
  title?: string
  /** Default `true`: inset separators between rows. */
  separated?: boolean
}

/** Items that belong together, as a list in a card on the tray. */
export function ItemGroup({ title, separated = true, className, children, ...rest }: ItemGroupProps) {
  const rows = Children.toArray(children)
  return (
    <div className={cx(styles.group, className)} {...rest}>
      {title ? <div className={styles.groupTitle}>{title}</div> : null}
      <ul className={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && separated ? <li role="none" className={styles.inset}><Separator /></li> : null}
            <li>{row}</li>
          </Fragment>
        ))}
      </ul>
    </div>
  )
}
