'use client'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ArrowUpIcon } from '@fetaui/react/rounded/arrow-up'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { CameraIcon } from '@fetaui/react/rounded/camera'
import { UploadIcon } from '@fetaui/react/rounded/upload'
import { Avatar, AVATAR_PEOPLE, type AvatarPerson } from '../avatar/avatar'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './avatar-upload.module.css'

const MEGABYTE = 1024 * 1024
const RING_SIZE = 64
const RING_RADIUS = 30
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const FAKE_TICK_MS = 120

type Upload = { state: 'empty' } | { state: 'uploading'; name: string; progress: number; src?: string; person?: AvatarPerson } | { state: 'uploaded'; name: string; size: string; src?: string; person?: AvatarPerson } | { state: 'error'; reason: string }

export type AvatarUploadProps = {
  /** Largest file, in MB. Default 5. */
  maxMb?: number
  accept?: string
  /** Does the upload and reports 0 to 100. Without it, progress is simulated. */
  upload?: (file: File, report: (percent: number) => void, signal: AbortSignal) => Promise<void>
  onChange?: (value: { src?: string; person?: AvatarPerson } | null) => void
  samples?: readonly AvatarPerson[]
  title?: string
  hint?: string
  /** Forces a state, for specimens and tests. */
  initial?: Upload
  animated?: boolean
  className?: string
}

/** The `accept` rules, for files that skip the picker, like a drop. */
const accepts = (file: File, accept: string): boolean => accept.split(',').some((part) => {
  const rule = part.trim().toLowerCase()
  if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule)
  return rule.endsWith('/*') ? file.type.startsWith(rule.slice(0, -1)) : file.type === rule
})

const sizeLabel = (bytes: number): string => (bytes >= MEGABYTE ? `${Math.round(bytes / MEGABYTE)} MB` : `${Math.round(bytes / 1024)} KB`)

/** A profile photo with drop, progress, replace and error, or a sample face. */
export function AvatarUpload({ maxMb = 5, accept = 'image/png,image/jpeg,image/webp', upload, onChange, samples = AVATAR_PEOPLE, title = 'Profile photo', hint, initial, animated = true, className }: AvatarUploadProps) {
  const still = useStill(animated)
  const input = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const objectUrl = useRef<string | null>(null)
  const [value, setValue] = useState<Upload>(initial ?? { state: 'empty' })
  const [over, setOver] = useState(false)

  useEffect(() => () => {
    abort.current?.abort()
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  async function take(file: File): Promise<void> {
    abort.current?.abort()
    if (!accepts(file, accept)) {
      setValue({ state: 'error', reason: 'That file type isn’t supported. Pick another photo.' })
      return
    }
    if (file.size > maxMb * MEGABYTE) {
      setValue({ state: 'error', reason: `That file is ${sizeLabel(file.size)}. Pick one under ${maxMb} MB.` })
      return
    }
    const controller = new AbortController()
    abort.current = controller
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = URL.createObjectURL(file)
    const preview = objectUrl.current
    setValue({ state: 'uploading', name: file.name, progress: 0, src: preview })
    const report = (percent: number): void => { if (!controller.signal.aborted) setValue((now) => (now.state === 'uploading' ? { ...now, progress: Math.round(percent) } : now)) }
    try {
      if (upload) await upload(file, report, controller.signal)
      else {
        for (let percent = 8; percent <= 100 && !controller.signal.aborted; percent += 8) {
          report(percent)
          await new Promise((done) => setTimeout(done, FAKE_TICK_MS))
        }
      }
      if (controller.signal.aborted) return
      setValue({ state: 'uploaded', name: file.name, size: sizeLabel(file.size), src: preview })
      onChange?.({ src: preview })
    } catch {
      if (!controller.signal.aborted) setValue({ state: 'error', reason: 'The upload failed. Try again.' })
    }
  }

  function pick(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (file) void take(file)
    e.target.value = ''
  }

  function drop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void take(file)
  }

  function clear(): void {
    abort.current?.abort()
    setValue({ state: 'empty' })
    onChange?.(null)
  }

  const browse = (): void => input.current?.click()
  const defaultHint = hint ?? `PNG, JPG or WebP, up to ${maxMb} MB`
  const uploaded = value.state === 'uploaded' ? value : null

  return (
    <div
      className={cx(styles.tray, className)}
      data-state={value.state}
      data-over={over ? '' : undefined}
      data-still={still ? '' : undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }}
      onDrop={drop}
    >
      <div className={styles.card}>
        <div className={styles.main}>
          <button type="button" className={styles.target} aria-label={value.state === 'uploaded' ? 'Replace photo' : 'Upload photo'} onClick={browse}>
            {uploaded ? (
              <Avatar size="xl" alt="" animated={animated} badge="edit" badgeLabel="Edit" {...(uploaded.src ? { src: uploaded.src } : {})} {...(uploaded.person ? { person: uploaded.person } : {})} />
            ) : value.state === 'uploading' ? (
              <span className={styles.progress}>
                <Avatar size="xl" alt="" animated={animated} loading={!value.src && !value.person} {...(value.src ? { src: value.src } : {})} {...(value.person ? { person: value.person } : {})} />
                <span className={styles.veil}>{value.progress}%</span>
                <svg aria-hidden="true" width={RING_SIZE} height={RING_SIZE} className={styles.arc}><circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} strokeWidth="3" strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - value.progress / 100)} /></svg>
              </span>
            ) : (
              <span className={styles.dashed} data-error={value.state === 'error' ? '' : undefined}>
                {over ? <span className={styles.drop}><ArrowUpIcon /></span> : value.state === 'error' ? <span className={styles.alert}><AlertCircleIcon /></span> : <CameraIcon />}
              </span>
            )}
          </button>
          <div className={styles.text}>
            <p className={styles.title}>{over ? 'Drop to set your photo' : title}</p>
            <p className={styles.meta} data-error={value.state === 'error' ? '' : undefined} role={value.state === 'error' ? 'alert' : undefined} aria-live="polite">
              {over ? 'Release anywhere on the card' : value.state === 'uploading' ? `Uploading ${value.name} · ${value.progress}%` : value.state === 'uploaded' ? `${value.name} · ${value.size}` : value.state === 'error' ? value.reason : defaultHint}
            </p>
            <div className={styles.actions}>
              {value.state === 'empty' ? <Button variant="secondary" size="sm" animated={animated} disabled={over} leadingIcon={<UploadIcon />} onClick={browse}>Upload photo</Button> : null}
              {value.state === 'uploading' ? <Button variant="ghost" size="sm" animated={animated} onClick={clear}>Cancel</Button> : null}
              {value.state === 'uploaded' ? <><Button variant="secondary" size="sm" animated={animated} leadingIcon={<UploadIcon />} onClick={browse}>Replace photo</Button><Button variant="ghost" size="sm" animated={animated} onClick={clear}>Remove</Button></> : null}
              {value.state === 'error' ? <><Button variant="secondary" size="sm" animated={animated} leadingIcon={<UploadIcon />} onClick={browse}>Try another photo</Button><Button variant="ghost" size="sm" animated={animated} onClick={clear}>Dismiss</Button></> : null}
            </div>
          </div>
        </div>
      </div>
      <input ref={input} type="file" accept={accept} tabIndex={-1} aria-hidden="true" className={styles.file} onChange={pick} />
      <div className={styles.samples}>
        <span className={styles.samplesLabel}>Or pick a sample</span>
        <div className={styles.sampleRow}>
          {samples.map((person) => (
            <button key={person} type="button" className={styles.sample} aria-label={`Use the ${person} sample`} aria-pressed={uploaded?.person === person} onClick={() => { abort.current?.abort(); setValue({ state: 'uploaded', name: `${person}.png`, size: 'sample', person }); onChange?.({ person }) }}>
              <Avatar person={person} size="sm" animated={animated} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
