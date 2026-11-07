'use client'
import type { ReactNode } from 'react'
import { StarIcon } from '@fetaui/react/rounded/star'
import { Avatar, type AvatarProps } from '../avatar/avatar'
import { cx } from '../motion-kit/motion-kit'
import { ExpandableText } from '../expandable-text/expandable-text'
import styles from './review-card.module.css'

const MAX_STARS = 5

export type ReviewCardProps = {
  name: string
  date: string
  /** Whole stars, 0 to 5. */
  rating: number
  headline: string
  /** One `<p>` per paragraph. A review that fits three lines has no toggle. */
  children: ReactNode
  avatar?: Pick<AvatarProps, 'src' | 'person' | 'initials'>
  animated?: boolean
  className?: string
}

/** A customer review: ink stars, a headline and three lines that open in place. */
export function ReviewCard({ name, date, rating, headline, children, avatar, animated = true, className }: ReviewCardProps) {
  return (
    <article className={cx(styles.card, className)}>
      <header className={styles.top}>
        <Avatar {...avatar} size="sm" alt="" animated={animated} />
        <span className={styles.name}>{name}</span>
        <span className={styles.date}>{date}</span>
      </header>
      <div className={styles.rating}>
        <div role="img" aria-label={`${rating} out of ${MAX_STARS} stars`} className={styles.stars}>
          {Array.from({ length: MAX_STARS }, (_, i) => <span key={i} className={styles.star} data-on={i < rating ? '' : undefined}><StarIcon /></span>)}
        </div>
        <h4 className={styles.headline}>{headline}</h4>
      </div>
      <ExpandableText animated={animated} moreAriaLabel="Show the full review">{children}</ExpandableText>
    </article>
  )
}
