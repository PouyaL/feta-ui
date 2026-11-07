'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { PauseIcon } from '@fetaui/react/rounded/pause'
import { PlayIcon } from '@fetaui/react/rounded/play'
import { RepeatIcon } from '@fetaui/react/rounded/repeat'
import { ShuffleIcon } from '@fetaui/react/rounded/shuffle'
import { SkipBackIcon } from '@fetaui/react/rounded/skip-back'
import { SkipForwardIcon } from '@fetaui/react/rounded/skip-forward'
import { ease } from '../../motion-tokens'
import { Card } from '../card/card'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './now-playing.module.css'

/** Play and pause: the icon morphs in 200 ms. */
const MORPH_DURATION = 0.2
const TICK_MS = 1000

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export type NowPlayingTrack = {
  title: string
  artist: string
  /** Seconds. */
  length: number
  /** An image, or `<NowPlayingArt />`. */
  cover?: ReactNode
}

export type NowPlayingProps = {
  track: NowPlayingTrack
  playing?: boolean
  /** Default true. */
  defaultPlaying?: boolean
  onPlayingChange?: (playing: boolean) => void
  /** Seconds. Leave it out and the card keeps its own time while playing. */
  elapsed?: number
  /** Default 0. */
  defaultElapsed?: number
  onSeek?: (seconds: number) => void
  onNext?: () => void
  onPrevious?: () => void
  onShuffleChange?: (shuffle: boolean) => void
  /** Repeat also restarts the track at the end, unless `elapsed` is controlled. */
  onRepeatChange?: (repeat: boolean) => void
  /** The one line mini player. */
  compact?: boolean
  onMore?: () => void
  animated?: boolean
  className?: string
}

/** The stand-in covers. Paper and ink stay the same in both modes. */
export function NowPlayingArt({ kind = 'tide' }: { kind?: 'tide' | 'bloom' }) {
  return (
    <span className={styles.art} data-kind={kind} aria-hidden="true">
      {kind === 'tide'
        ? <><i className={styles.sun} />{[0, 1, 2, 3, 4].map((wave) => <i key={wave} className={styles.ripple} style={{ '--wave': wave } as CSSProperties} />)}</>
        : [0, 1, 2].map((ring) => <i key={ring} className={styles.ring} style={{ '--ring': ring } as CSSProperties} />)}
    </span>
  )
}

function Equalizer({ playing, still }: { playing: boolean; still: boolean }) {
  return (
    <span ref={watchOffscreen} className={styles.equalizer} data-loop="" data-playing={playing ? '' : undefined} data-still={still ? '' : undefined} aria-hidden="true">
      {[0.5, 1, 0.67, 0.83].map((rest, index) => <i key={index} className={styles.bar} style={{ '--rest': rest, '--bar': index } as CSSProperties} />)}
    </span>
  )
}

/** A music player on the Card tray, with a live progress bar and a compact mini player. */
export function NowPlaying({ track, playing, defaultPlaying = true, onPlayingChange, elapsed, defaultElapsed = 0, onSeek, onNext, onPrevious, onShuffleChange, onRepeatChange, compact = false, onMore, animated = true, className }: NowPlayingProps) {
  const still = useStill(animated)
  const [heldPlaying, setHeldPlaying] = useState(defaultPlaying)
  const [heldTime, setHeldTime] = useState(defaultElapsed)
  const [seeking, setSeeking] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const isPlaying = playing ?? heldPlaying
  // A new track starts from the top.
  const trackKey = `${track.title}|${track.length}`
  const [heldTrack, setHeldTrack] = useState(trackKey)
  if (trackKey !== heldTrack) { setHeldTrack(trackKey); setHeldTime(0) }
  const time = Math.min(elapsed ?? heldTime, track.length)

  function setPlaying(next: boolean): void {
    if (next && elapsed === undefined && time >= track.length) { setHeldTime(0); onSeek?.(0) }
    setHeldPlaying(next)
    onPlayingChange?.(next)
  }

  useEffect(() => {
    if (!isPlaying || seeking || elapsed !== undefined) return
    const timer = setInterval(() => {
      setHeldTime((current) => Math.min(current + 1, track.length))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [isPlaying, seeking, elapsed, track.length])

  useEffect(() => {
    if (time < track.length || !isPlaying || elapsed !== undefined) return
    if (repeat) { setHeldTime(0); return }
    setHeldPlaying(false)
    onPlayingChange?.(false)
  }, [time, track.length, isPlaying, elapsed, onPlayingChange, repeat])

  const toggle = (
    <IconButton
      size={compact ? 'sm' : 'lg'}
      animated={animated}
      label={isPlaying ? 'Pause' : 'Play'}
      onClick={() => setPlaying(!isPlaying)}
      icon={
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={isPlaying ? 'pause' : 'play'}
            className={styles.morph}
            initial={still ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6 }}
            transition={{ duration: MORPH_DURATION, ease: ease.out }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </motion.span>
        </AnimatePresence>
      }
    />
  )
  const cover = track.cover ?? <NowPlayingArt />

  if (compact) {
    return (
      <Card aria-label={`${isPlaying ? 'Now playing' : 'Paused'}: ${track.title}`} className={cx(styles.player, className)} bodyClassName={styles.compact} animated={animated}>
        <span className={styles.coverSmall}>{cover}</span>
        <div className={styles.compactText}>
          <p className={styles.compactTitle}>{track.title}</p>
          <p className={styles.compactSub}><Equalizer playing={isPlaying} still={still} /><span className={styles.ellipsis}>{track.artist} · {clock(time)}</span></p>
        </div>
        <IconButton size="sm" variant="ghost" icon={<SkipForwardIcon />} label="Next" animated={animated} onClick={onNext} />
        {toggle}
      </Card>
    )
  }

  return (
    <Card aria-label={`${isPlaying ? 'Now playing' : 'Paused'}: ${track.title}`} className={cx(styles.player, className)} animated={animated}>
      <div className={styles.top}>
        <span className={styles.cover}>{cover}</span>
        <div className={styles.text}>
          <p className={styles.kicker}><Equalizer playing={isPlaying} still={still} />{isPlaying ? 'Now playing' : 'Paused'}</p>
          <p className={styles.track}>{track.title}</p>
          <p className={styles.artist}>{track.artist}</p>
        </div>
        <IconButton size="sm" variant="ghost" icon={<MoreHorizontalIcon />} label="More" animated={animated} onClick={onMore} />
      </div>
      <div className={styles.progress}>
        <div className={styles.rail} data-seeking={seeking || still ? '' : undefined}>
          <span className={styles.fill} style={{ transform: `scaleX(${track.length ? time / track.length : 0})` }} />
          <input
            className={styles.seek}
            type="range"
            aria-label="Seek"
            aria-valuetext={`${clock(time)} of ${clock(track.length)}`}
            min={0}
            max={track.length}
            step={1}
            value={time}
            onPointerDown={() => setSeeking(true)}
            onPointerUp={() => setSeeking(false)}
            onPointerCancel={() => setSeeking(false)}
            onBlur={() => setSeeking(false)}
            onChange={(event) => { const next = Number(event.target.value); setHeldTime(next); onSeek?.(next) }}
          />
        </div>
        <div className={styles.times}><span>{clock(time)}</span><span>{clock(track.length)}</span></div>
      </div>
      <div className={styles.controls}>
        <IconButton className={styles.toggle} size="sm" variant="ghost" icon={<ShuffleIcon />} label="Shuffle" aria-pressed={shuffle} animated={animated} onClick={() => { setShuffle(!shuffle); onShuffleChange?.(!shuffle) }} />
        <div className={styles.main}>
          <IconButton variant="ghost" icon={<SkipBackIcon />} label="Previous" animated={animated} onClick={onPrevious} />
          {toggle}
          <IconButton variant="ghost" icon={<SkipForwardIcon />} label="Next" animated={animated} onClick={onNext} />
        </div>
        <IconButton className={styles.toggle} size="sm" variant="ghost" icon={<RepeatIcon />} label="Repeat" aria-pressed={repeat} animated={animated} onClick={() => { setRepeat(!repeat); onRepeatChange?.(!repeat) }} />
      </div>
    </Card>
  )
}
