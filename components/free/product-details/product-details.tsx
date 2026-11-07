'use client'
import type { ReactNode } from 'react'
import { cx } from '../motion-kit/motion-kit'
import { ExpandableText } from '../expandable-text/expandable-text'
import { ReviewCard, type ReviewCardProps } from '../review-card/review-card'
import styles from './product-details.module.css'

export type ProductDetailsProps = {
  name: string
  price: string
  priceNote?: string
  /** One `<p>` per paragraph. */
  description: ReactNode
  score?: string
  /** The product photo. Beside the copy on Web, above it on Mobile. */
  media?: ReactNode
  reviews: (Omit<ReviewCardProps, 'animated' | 'className'> & { id: string })[]
  animated?: boolean
  className?: string
}

/** Expandable Text and Review Card composed into a real product block. */
export function ProductDetails({ name, price, priceNote, description, score, media, reviews, animated = true, className }: ProductDetailsProps) {
  return (
    <section className={cx(styles.tray, className)} aria-label={name}>
      <div className={styles.card}>
        {media ? <div className={styles.media}>{media}</div> : null}
        <div className={styles.copy}>
          <div className={styles.head}>
            <h3 className={styles.name}>{name}</h3>
            <p className={styles.price}>{price}{priceNote ? <span className={styles.note}> {priceNote}</span> : null}</p>
          </div>
          <ExpandableText animated={animated}>{description}</ExpandableText>
        </div>
      </div>
      <div className={styles.reviewsHead}>
        <h4 className={styles.reviewsTitle}>Reviews</h4>
        {score ? <span className={styles.score}>{score}</span> : null}
      </div>
      {reviews.map(({ id, ...review }) => <ReviewCard key={id} {...review} animated={animated} />)}
    </section>
  )
}
