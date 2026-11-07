'use client'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Tag, kit, type Tone } from '../data-kit/data-kit'
import styles from './endpoint.module.css'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export const METHOD_TONE: Record<HttpMethod, Tone> = { GET: 'info', POST: 'success', PUT: 'warning', PATCH: 'accent', DELETE: 'danger' }

export type EndpointProps = {
  method: HttpMethod
  path: string
  summary: string
  /** Makes the row a link. */
  href?: string
  onClick?: () => void
  animated?: boolean
  className?: string | undefined
}

/** A method Badge in a fixed column, a mono path and a one line summary. */
export function Endpoint({ method, path, summary, href, onClick, animated = true, className }: EndpointProps) {
  const still = useStill(animated)
  const attrs = { className: cx(styles.row, kit.row, className), 'data-still': still ? '' : undefined }
  const body = (
    <>
      <span className={styles.method}><Tag tone={METHOD_TONE[method]} mark mono>{method}</Tag></span>
      <span className={styles.text}><code className={styles.path}>{path}</code><span className={styles.summary}>{summary}</span></span>
      <ChevronRightIcon size={16} aria-hidden="true" className={cx(styles.chevron)} />
    </>
  )
  if (href) return <a href={href} {...attrs} onClick={onClick}>{body}</a>
  return <button type="button" {...attrs} onClick={onClick}>{body}</button>
}
