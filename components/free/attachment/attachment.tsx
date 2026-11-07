'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { ArchiveIcon } from '@fetaui/react/rounded/archive'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { FileTextIcon } from '@fetaui/react/rounded/file-text'
import { FileVideoIcon } from '@fetaui/react/rounded/file-video'
import { ImageIcon } from '@fetaui/react/rounded/image'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { MicIcon } from '@fetaui/react/rounded/mic'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { TableIcon } from '@fetaui/react/rounded/table'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { UndoIcon } from '@fetaui/react/rounded/undo'
import { UploadIcon } from '@fetaui/react/rounded/upload'
import { XIcon } from '@fetaui/react/rounded/x'
import { duration, ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './attachment.module.css'

export type AttachmentType = 'file' | 'image' | 'pdf' | 'archive' | 'sheet' | 'code' | 'video' | 'audio'
export type AttachmentStatus = 'ready' | 'uploading' | 'processing' | 'error' | 'uploaded'

const GLYPH: Record<AttachmentType, ReactNode> = {
  file: <FileTextIcon trigger="none" />, image: <ImageIcon trigger="none" />, pdf: <FileTextIcon trigger="none" />, archive: <ArchiveIcon trigger="none" />,
  sheet: <TableIcon trigger="none" />, code: <FileTextIcon trigger="none" />, video: <FileVideoIcon trigger="none" />, audio: <MicIcon trigger="none" />,
}

export type AttachmentProps = {
  name: string
  /** The meta line: a size, or a reason. */
  meta?: string
  type?: AttachmentType
  status?: AttachmentStatus
  /** 0 to 100 while uploading. */
  progress?: number
  size?: 'default' | 'small' | 'xsmall'
  /** `vertical` is a 168 px card with a 160 by 112 preview, and actions sit on the preview. */
  orientation?: 'horizontal' | 'vertical'
  onRemove?: () => void
  onRetry?: () => void
  onMore?: () => void
  animated?: boolean
  className?: string
}

/** A file on its way up or already there: a type tile, the name, a live status and actions. */
export function Attachment({ name, meta, type = 'file', status = 'ready', progress = 0, size = 'default', orientation = 'horizontal', onRemove, onRetry, onMore, animated = true, className }: AttachmentProps) {
  const still = useStill(animated)
  const busy = status === 'uploading' || status === 'processing'
  const statusText = status === 'uploading' ? `Uploading, ${progress}%` : status === 'processing' ? 'Processing' : status === 'error' ? 'Upload failed' : status === 'uploaded' ? 'Uploaded' : meta
  return (
    <motion.div
      className={cx(styles.card, className)}
      data-size={size}
      data-orientation={orientation}
      data-status={status}
      data-still={still ? '' : undefined}
      {...(status === 'error' && !still ? { animate: { x: [0, 4, -4, 0] }, transition: { duration: duration.shake, ease: ease.out } } : {})}
    >
      <span className={styles.tile} data-type={type} aria-hidden="true">
        {GLYPH[type]}
        {status === 'uploading' ? <span className={styles.veil}><span className={styles.spin}><LoaderIcon trigger="none" /></span></span> : null}
        <AnimatePresence initial={false}>
          {status === 'uploaded' || status === 'error' ? (
            <motion.span key={status} className={styles.badge} data-kind={status} initial={still ? false : { scale: 0 }} animate={{ scale: 1 }} transition={spring.pop}>
              {status === 'uploaded' ? <Tick02Icon trigger="none" /> : <AlertCircleIcon trigger="none" />}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {size === 'xsmall' ? null : <span className={styles.meta} role="status">{statusText}</span>}
        {busy && size !== 'xsmall' ? (
          <span className={styles.bar} role="progressbar" aria-label={`Upload of ${name}`} {...(status === 'uploading' ? { 'aria-valuenow': progress, 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}>
            <span className={styles.fill} data-sweep={status === 'processing' ? '' : undefined} style={status === 'uploading' ? { width: `${progress}%` } : undefined} />
          </span>
        ) : null}
      </span>
      <span className={styles.actions}>
      {status === 'error' && onRetry ? <IconButton variant="ghost" size="sm" animated={animated} label={`Retry ${name}`} icon={<UndoIcon />} onClick={onRetry} /> : null}
      {status === 'uploaded' && onMore ? <IconButton variant="ghost" size="sm" animated={animated} label={`More for ${name}`} icon={<MoreHorizontalIcon />} onClick={onMore} /> : null}
      {onRemove ? <IconButton variant="ghost" size="sm" animated={animated} label={`Remove ${name}`} icon={<XIcon />} onClick={onRemove} /> : null}
      </span>
    </motion.div>
  )
}

export type AttachmentGroupProps = {
  items: UploadItem[]
  /** The row's accessible name. */
  label?: string
  animated?: boolean
  className?: string
}

const PAGE = 296

/** A row of small cards, as above a message composer. When it overflows it scrolls and fades. */
export function AttachmentGroup({ items, label = 'Attachments', animated = true, className }: AttachmentGroupProps) {
  const still = useStill(animated)
  const row = useRef<HTMLUListElement>(null)
  const [fade, setFade] = useState(false)

  function measure(): void {
    const node = row.current
    if (node) setFade(node.scrollLeft + node.clientWidth < node.scrollWidth - 1)
  }

  useEffect(() => {
    measure()
    const node = row.current
    if (!node) return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [items.length])

  return (
    <div role="group" aria-label={label} className={cx(styles.group, className)} data-fade={fade ? '' : undefined}>
      <ul ref={row} className={styles.groupRow} onScroll={measure}>
        <AnimatePresence initial={false}>
          {items.map(({ id, ...item }) => (
            <motion.li key={id} layout={!still} initial={still ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96 }} transition={still ? { duration: 0 } : spring.row}>
              <Attachment {...item} size="small" animated={animated} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {fade ? <IconButton variant="outline" size="sm" animated={animated} label="More attachments" className={styles.pager} icon={<ArrowRightIcon />} onClick={() => row.current?.scrollBy({ left: PAGE, behavior: still ? 'auto' : 'smooth' })} /> : null}
    </div>
  )
}

export type UploadItem = AttachmentProps & { id: string }

export type FileUploadProps = {
  items?: UploadItem[]
  /** Fires with the files from a drop or Browse that pass `accept` and `multiple`. */
  onFiles?: (files: File[]) => void
  /** Like the input's `accept`: extensions and MIME types, comma separated. A convenience, not a security check. */
  accept?: string
  multiple?: boolean
  /** The limits line. */
  hint?: string
  footer?: ReactNode
  animated?: boolean
  className?: string
}

function fits(file: File, rule: string): boolean {
  if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule)
  const type = file.type.toLowerCase()
  return rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule
}

/** The one check for a drop and for Browse, whose dialog can be switched to all files. */
function allowedFiles(files: File[], accept: string | undefined, multiple: boolean): File[] {
  const rules = accept?.split(',').map((rule) => rule.trim().toLowerCase()).filter(Boolean) ?? []
  const allowed = rules.length ? files.filter((file) => rules.some((rule) => fits(file, rule))) : files
  return multiple ? allowed : allowed.slice(0, 1)
}

/** A drop zone and an upload queue. Rows grow in on a spring and fold away when removed. */
export function FileUpload({ items = [], onFiles, accept, multiple = true, hint = 'PNG, PDF or ZIP, up to 20 MB', footer, animated = true, className }: FileUploadProps) {
  const still = useStill(animated)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  function take(files: File[]): void {
    const allowed = allowedFiles(files, accept, multiple)
    if (allowed.length) onFiles?.(allowed)
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setOver(false)
    take([...e.dataTransfer.files])
  }

  return (
    <div className={cx(styles.upload, className)} data-still={still ? '' : undefined}>
      <div
        className={styles.zone}
        data-over={over ? '' : undefined}
        data-compact={items.length ? '' : undefined}
        onDragEnter={(e) => { e.preventDefault(); setOver(true) }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }}
        onDrop={onDrop}
      >
        <span className={styles.zoneIcon} aria-hidden="true"><UploadIcon /></span>
        <span className={styles.zoneText}>
          <span className={styles.name}>Drop files here</span>
          <span className={styles.meta}>{hint}</span>
        </span>
        <Button size="sm" variant="secondary" animated={animated} onClick={() => input.current?.click()}>Browse</Button>
        <input ref={input} type="file" hidden multiple={multiple} {...(accept ? { accept } : {})} aria-label="Choose files" onChange={(e) => { take([...(e.target.files ?? [])]); e.target.value = '' }} />
      </div>
      <ul className={styles.queue}>
        <AnimatePresence initial={false}>
          {items.map(({ id, ...item }) => (
            <motion.li
              key={id}
              initial={still ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0, transition: { duration: duration.exit, ease: ease.out } }}
              transition={{ height: spring.row, opacity: { duration: duration.base, delay: 0.05 } }}
              className={styles.row}
            >
              <Attachment {...item} animated={animated} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  )
}
