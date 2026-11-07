'use client'
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { UserIcon } from '@fetaui/react/rounded/user'
import { DiceIcon } from '@fetaui/react/rounded/dice'
import { Avatar, AvatarPhoto, type AvatarPerson } from '../avatar/avatar'
import { Button } from '../button/button'
import { Field } from '../field/field'
import { IconButton } from '../icon-button/icon-button'
import { Input } from '../input/input'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './avatar-picker.module.css'

const COIN_SPRING = { type: 'spring', stiffness: 140, damping: 22 } as const
const FLIP = 180
const DRAG_DEG_PER_PX = 1.1
const THROW_MS = 160
const PICK_SPRING = { type: 'spring', duration: 0.3, bounce: 0.3 } as const

export type AvatarOption = { person: AvatarPerson; name: string }

export type AvatarPickerProps = {
  options: AvatarOption[]
  title?: string
  hint?: string
  spinningHint?: string
  defaultName?: string
  /** Fires when Continue is pressed. */
  onContinue?: (choice: { person: AvatarPerson; name: string }) => void
  animated?: boolean
  className?: string
}

const wrap = (index: number, length: number): number => ((index % length) + length) % length

/** A coin that spins on real physics and settles on a face. */
export function AvatarPicker({ options, title = 'Pick your avatar', hint = 'Spin the coin or pick a face.', spinningHint = 'Spinning… let go to land on a face.', defaultName, onContinue, animated = true, className }: AvatarPickerProps) {
  const still = useStill(animated)
  const ringId = useId()
  const count = options.length
  const rotate = useMotionValue(0)
  const shade = useTransform(rotate, (value) => Math.abs(Math.sin((value * Math.PI) / 180)) * 0.4)
  const [turn, setTurn] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [picked, setPicked] = useState(false)
  const [name, setName] = useState(defaultName ?? '')
  const [edited, setEdited] = useState(defaultName !== undefined)
  const drag = useRef<{ x: number; from: number; last: number; at: number; speed: number } | null>(null)
  const settle = useRef<ReturnType<typeof animate> | null>(null)
  const index = wrap(turn, count)
  const current = options[index]
  const shownName = edited ? name : current?.name ?? ''

  useMotionValueEvent(rotate, 'change', (value) => {
    const next = Math.round(value / FLIP)
    setTurn((old) => (old === next ? old : next))
  })

  useEffect(() => () => settle.current?.stop(), [])

  function land(target: number): void {
    setSpinning(false)
    setPicked(true)
    settle.current?.stop()
    if (still) { rotate.set(target * FLIP); return }
    settle.current = animate(rotate, target * FLIP, COIN_SPRING)
  }

  function step(by: number): void {
    land(Math.round(rotate.get() / FLIP) + by)
  }

  function choose(at: number): void {
    const now = Math.round(rotate.get() / FLIP)
    land(now + ((at - wrap(now, count) + count) % count))
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId)
    settle.current?.stop()
    drag.current = { x: e.clientX, from: rotate.get(), last: e.clientX, at: e.timeStamp, speed: 0 }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    const held = drag.current
    if (!held) return
    const delta = e.clientX - held.x
    if (Math.abs(delta) > 2) setSpinning(true)
    if (still) return
    held.speed = (e.clientX - held.last) / Math.max(1, e.timeStamp - held.at)
    held.last = e.clientX
    held.at = e.timeStamp
    rotate.set(held.from + delta * DRAG_DEG_PER_PX)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    const held = drag.current
    drag.current = null
    if (!held) return
    if (still) {
      const delta = e.clientX - held.x
      if (Math.abs(delta) > 8) step(delta > 0 ? 1 : -1)
      else setSpinning(false)
      return
    }
    // The flick carries on for a moment, then the spring takes the nearest face.
    land(Math.round((rotate.get() + held.speed * THROW_MS * DRAG_DEG_PER_PX) / FLIP))
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const by = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (by === undefined) return
    e.preventDefault()
    step(by)
  }

  function onFaceKey(at: number, e: KeyboardEvent<HTMLButtonElement>): void {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (by === undefined) return
    e.preventDefault()
    const next = wrap(at + by, count)
    choose(next)
    e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  const face = (offset: number): AvatarPerson | null => options[wrap(turn + offset, count)]?.person ?? null
  const even = turn % 2 === 0
  const front = even ? face(0) : face(1)
  const back = even ? face(1) : face(0)
  const empty = edited && name.trim() === ''

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined}>
      <div className={styles.card}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.hint}>{spinning ? spinningHint : hint}</p>
        <div className={styles.stage}>
          <span aria-hidden="true" className={styles.bezel} />
          <div
            role="slider"
            tabIndex={0}
            aria-label="Avatar"
            aria-valuemin={1}
            aria-valuemax={count}
            aria-valuenow={index + 1}
            aria-valuetext={current?.name}
            className={styles.coinHit}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            <motion.div className={styles.coin} style={{ rotateY: rotate }}>
              <span className={styles.side} data-empty={empty ? '' : undefined}>{empty ? <UserIcon /> : front ? <AvatarPhoto person={front} /> : null}</span>
              <span className={styles.side} data-back="" data-empty={empty ? '' : undefined}>{empty ? <UserIcon /> : back ? <AvatarPhoto person={back} /> : null}</span>
              <motion.span aria-hidden="true" className={styles.shade} style={{ opacity: shade }} />
            </motion.div>
          </div>
          {picked && !empty ? (
            <motion.span role="img" aria-label="Picked" className={styles.badge} initial={still ? false : { scale: 0 }} animate={{ scale: 1 }} transition={PICK_SPRING}><Tick02Icon /></motion.span>
          ) : null}
        </div>
        <p className={styles.caption}><span>{empty ? 'Add your name' : shownName}</span><span className={styles.number}>No. {String(index + 1).padStart(3, '0')}</span></p>
        <div role="radiogroup" aria-label="Faces" className={styles.options}>
          {options.map((option, i) => (
            <button key={option.person} type="button" role="radio" aria-checked={i === index} aria-label={option.name} tabIndex={i === index ? 0 : -1} className={styles.option} onClick={() => choose(i)} onKeyDown={(e) => onFaceKey(i, e)}>
              {i === index ? <motion.span {...(still ? {} : { layoutId: ringId })} className={styles.ring} transition={PICK_SPRING} /> : null}
              <Avatar person={option.person} size="md" animated={animated} />
            </button>
          ))}
          <span className={styles.spacer} /><IconButton variant="secondary" size="sm" icon={<DiceIcon />} label="Shuffle" animated={animated} onClick={() => step(1 + Math.floor(Math.random() * Math.max(1, count - 1)))} />
        </div>
        <Field label="Display name">
          <Input animated={animated} value={shownName} placeholder="Your name" onChange={(e) => { setEdited(true); setName(e.target.value) }} />
        </Field>
      </div>
      <Button className={styles.continue} animated={animated} disabled={shownName.trim() === '' || spinning} trailingIcon={<ArrowRightIcon />} onClick={() => { if (current) onContinue?.({ person: current.person, name: shownName.trim() }) }}>Continue</Button>
    </div>
  )
}
