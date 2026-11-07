'use client'
import { animate } from 'motion/react'
import { useId, useRef, useState } from 'react'
import { HeartIcon } from '@fetaui/react/rounded/heart'
import { Badge } from '../badge/badge'
import { Card } from '../card/card'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Skeleton } from '../skeleton/skeleton'
import { RAIL_SCENES, RAIL_TRIPS, type RailTrip } from './rail-scenes'
import styles from './rail-card.module.css'

export { RAIL_TRIPS, type RailTrip }

/** Save: 300 ms from the 16.5 Motion frame. */
const SAVE_DURATION = 0.3
const SAVE_SCALE = 1.2

export type RailCardSceneProps = {
  /** Default `Weekend in Lisbon`. */
  trip?: RailTrip
  /** Names the art. Without it the scene is decorative. */
  alt?: string
  className?: string | undefined
}

/** A paper scene that keeps its tone in Light and Dark. Swap `trip`, or put an image in its place. */
export function RailCardScene({ trip = 'Weekend in Lisbon', alt, className }: RailCardSceneProps) {
  return (
    <svg className={cx(styles.scene, className)} viewBox="0 0 256 320" preserveAspectRatio="xMidYMid slice" {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}>
      <rect width="256" height="320" className={styles.sky} />
      {RAIL_SCENES[trip].map((shape, index) => {
        const fill = styles[shape.tone]
        if ('d' in shape) return <path key={index} className={fill} d={shape.d} />
        if ('circle' in shape) return <circle key={index} className={fill} cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} />
        return <rect key={index} className={fill} x={shape.rect[0]} y={shape.rect[1]} width={shape.rect[2]} height={shape.rect[3]} />
      })}
    </svg>
  )
}

export type RailCardProps = {
  /** Picks the scene and the default title. Default `Weekend in Lisbon`. */
  trip?: RailTrip
  title?: string
  location: string
  /** The line under the location, such as a rating and dates. */
  details: string
  /** Such as `€340 total`. */
  price: string
  /** Such as `2 nights`. */
  nights: string
  /** Makes the card a link, through a link on the title stretched over it. */
  href?: string
  /** An image in place of the scene. */
  image?: string
  saved?: boolean
  defaultSaved?: boolean
  onSavedChange?: (saved: boolean) => void
  /** A skeleton at the same height. */
  loading?: boolean
  /** Shows the Hover look without a pointer, for previews. */
  hovered?: boolean
  animated?: boolean
  className?: string
}

/** A trip card for horizontal rails: scene, nights, a heart that saves, title, place, rating and the total. */
export function RailCard({ trip = 'Weekend in Lisbon', title = trip, location, details, price, nights, href, image, saved, defaultSaved = false, onSavedChange, loading = false, hovered = false, animated = true, className }: RailCardProps) {
  const still = useStill(animated)
  const titleId = useId()
  const [held, setHeld] = useState(defaultSaved)
  const heart = useRef<HTMLSpanElement>(null)
  const on = saved ?? held

  function toggle(): void {
    setHeld(!on)
    onSavedChange?.(!on)
    if (!still && heart.current) animate(heart.current, { scale: [1, SAVE_SCALE, 1] }, { duration: SAVE_DURATION })
  }

  if (loading) {
    return (
      <div className={cx(styles.rail, styles.skeleton, className)} aria-busy="true" role="status" aria-label="Loading trip">
        <Skeleton shape="block" className={styles.boneImage} animated={!still} />
        <span className={styles.boneLines}>
          <Skeleton width="70%" height={12} animated={!still} />
          <Skeleton width="42.5%" height={10} animated={!still} />
          <Skeleton height={10} animated={!still} />
        </span>
      </div>
    )
  }

  return (
    // `href` here only turns on Card's hover and press. The link itself is on the title below the art.
    <Card className={cx(styles.rail, className)} bodyClassName={styles.body} {...(href ? { href } : {})} aria-labelledby={titleId} data-hovered={hovered ? '' : undefined} animated={animated}>
      <div className={styles.image}>
        {image ? <img className={styles.photo} src={image} alt="" /> : <RailCardScene trip={trip} />}
        <span className={styles.nights}><Badge variant="inverse" size="sm" mark={false} animated={animated}>{nights}</Badge></span>
        <span ref={heart} className={styles.save}>
          <IconButton size="sm" variant={on ? 'primary' : 'secondary'} icon={<HeartIcon />} label={`Save ${title}`} aria-pressed={on} data-hovered={hovered ? '' : undefined} animated={animated} onClick={toggle} />
        </span>
      </div>
      <div className={styles.text}>
        <h3 id={titleId} className={styles.title}>{href ? <a className={styles.link} href={href}>{title}</a> : title}</h3>
        <p className={styles.location}>{location}</p>
        <p className={styles.row}><span className={styles.dates}>{details}</span><span className={styles.price}>{price}</span></p>
      </div>
    </Card>
  )
}
