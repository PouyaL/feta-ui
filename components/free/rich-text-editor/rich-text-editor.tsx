'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { HeadingIcon } from '@fetaui/react/rounded/heading'
import { LeftToRightListBulletIcon } from '@fetaui/react/rounded/left-to-right-list-bullet'
import { QuoteDownIcon } from '@fetaui/react/rounded/quote-down'
import { RedoIcon } from '@fetaui/react/rounded/redo'
import { RotateCcwIcon } from '@fetaui/react/rounded/rotate-ccw'
import { SourceCodeIcon } from '@fetaui/react/rounded/source-code'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { LinkIcon } from '@fetaui/react/rounded/link'
import { TextBoldIcon } from '@fetaui/react/rounded/text-bold'
import { TextItalicIcon } from '@fetaui/react/rounded/text-italic'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { UndoIcon } from '@fetaui/react/rounded/undo'
import { ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, LabelSwap, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './rich-text-editor.module.css'

const COPIED_HOLD_MS = 2000
const BAR_S = 0.14
const MENU_S = 0.16
const BLOCKS = [
  { name: 'Heading', hint: 'Big section title', tag: 'h2' },
  { name: 'Bulleted list', hint: 'A simple list', tag: 'ul' },
  { name: 'Quote', hint: 'Call out a note', tag: 'blockquote' },
  { name: 'Code block', hint: 'Monospaced snippet', tag: 'pre' },
] as const
type Format = 'bold' | 'italic' | 'code' | 'heading' | 'quote' | 'list'
const FORMATS: { kind: Format; label: string; icon: ReactNode }[] = [
  { kind: 'bold', label: 'Bold', icon: <TextBoldIcon /> },
  { kind: 'italic', label: 'Italic', icon: <TextItalicIcon /> },
  { kind: 'code', label: 'Code', icon: <SourceCodeIcon /> },
  { kind: 'heading', label: 'Heading', icon: <HeadingIcon /> },
  { kind: 'quote', label: 'Quote', icon: <QuoteDownIcon /> },
  { kind: 'list', label: 'Bulleted list', icon: <LeftToRightListBulletIcon /> },
]

const ZERO_WIDTH = '\u200B'
const plainText = (node: Node): string => (node.textContent ?? '').replaceAll(ZERO_WIDTH, '')
const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeUrl = (href: string): string => (/^(https?:|mailto:)/i.test(href) ? href : '')

/** Only known tags and safe links survive, whatever was pasted or typed. */
function inlineHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(plainText(node))
  if (!(node instanceof HTMLElement)) return ''
  const inner = Array.from(node.childNodes).map(inlineHtml).join('')
  const tag = node.tagName.toLowerCase()
  if (tag === 'b' || tag === 'strong') return `<strong>${inner}</strong>`
  if (tag === 'i' || tag === 'em') return `<em>${inner}</em>`
  if (tag === 'code') return `<code>${inner}</code>`
  if (tag === 'a') { const href = safeUrl(node.getAttribute('href') ?? ''); return href ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner }
  return inner
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return plainText(node)
  if (!(node instanceof HTMLElement)) return ''
  const inner = Array.from(node.childNodes).map(inlineMarkdown).join('')
  const tag = node.tagName.toLowerCase()
  if (tag === 'b' || tag === 'strong') return `**${inner}**`
  if (tag === 'i' || tag === 'em') return `*${inner}*`
  if (tag === 'code') return `\`${inner}\``
  if (tag === 'a') { const href = safeUrl(node.getAttribute('href') ?? ''); return href ? `[${inner}](${href})` : inner }
  return inner
}

function toHtml(root: HTMLElement): string {
  return Array.from(root.children).map((block) => {
    const tag = block.tagName.toLowerCase()
    if (tag === 'ul') return `<ul>\n${Array.from(block.children).map((item) => `  <li>${inlineHtml(item)}</li>`).join('\n')}\n</ul>`
    if (tag === 'pre') return `<pre><code>${escapeHtml(block.textContent ?? '')}</code></pre>`
    const name = ['h1', 'h2', 'blockquote'].includes(tag) ? tag : 'p'
    return `<${name}>${inlineHtml(block)}</${name}>`
  }).join('\n')
}

function toMarkdown(root: HTMLElement): string {
  return Array.from(root.children).map((block) => {
    const tag = block.tagName.toLowerCase()
    if (tag === 'h1') return `# ${inlineMarkdown(block)}`
    if (tag === 'h2') return `## ${inlineMarkdown(block)}`
    if (tag === 'blockquote') return `> ${inlineMarkdown(block)}`
    if (tag === 'pre') return `\`\`\`\n${block.textContent ?? ''}\n\`\`\``
    if (tag === 'ul') return Array.from(block.children).map((item) => `- ${inlineMarkdown(item)}`).join('\n')
    return inlineMarkdown(block)
  }).join('\n\n')
}

export type RichTextEditorProps = {
  /** The first content, as elements: h1, h2, p, ul, blockquote, pre. Rendered once. */
  children?: ReactNode
  label?: string
  placeholder?: string
  /** Hide the source panel. On Mobile it is always hidden. */
  source?: boolean
  onChange?: (value: { markdown: string; html: string }) => void
  animated?: boolean
  className?: string
}

/** Short structured writing that exports clean Markdown and HTML. */
export function RichTextEditor({ children, label = 'Editor', placeholder = 'Start writing, or type / for blocks', source = true, onChange, animated = true, className }: RichTextEditorProps) {
  const still = useStill(animated)
  const area = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const first = useRef(children)
  const [tab, setTab] = useState<'markdown' | 'html'>('markdown')
  const [out, setOut] = useState({ markdown: '', html: '', words: 0 })
  const [bar, setBar] = useState<{ x: number; y: number } | null>(null)
  const [slash, setSlash] = useState<{ x: number; y: number; query: string; active: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [linking, setLinking] = useState(false)
  const [url, setUrl] = useState('')
  const saved = useRef<Range | null>(null)
  const movingText = useRef(false)
  const matches = slash ? BLOCKS.filter((block) => block.name.toLowerCase().includes(slash.query.toLowerCase())) : []

  function sync(): void {
    const node = area.current
    if (!node) return
    // `innerText` keeps the break between blocks, so words on two lines stay two.
    const text = node.innerText.trim()
    const next = { markdown: toMarkdown(node), html: toHtml(node), words: text ? text.split(/\s+/).length : 0 }
    setOut(next)
    onChange?.({ markdown: next.markdown, html: next.html })
  }

  useEffect(() => {
    sync()
    const onSelection = (): void => {
      const selection = document.getSelection()
      const node = area.current
      if (!selection || !node || !selection.anchorNode || !node.contains(selection.anchorNode)) { if (!linking) setBar(null); return }
      if (selection.isCollapsed) { setBar(null); return }
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      const host = shell.current?.getBoundingClientRect()
      if (host) setBar({ x: rect.left - host.left + rect.width / 2, y: rect.top - host.top })
    }
    document.addEventListener('selectionchange', onSelection)
    return () => { document.removeEventListener('selectionchange', onSelection); clearTimeout(timer.current) }
  }, [linking])

  function history(command: 'undo' | 'redo'): void {
    area.current?.focus()
    document.execCommand(command)
    sync()
  }

  function clearAll(): void {
    const node = area.current
    if (!node) return
    node.focus()
    // Through the editing commands, so Undo brings it back.
    document.getSelection()?.selectAllChildren(node)
    document.execCommand('delete')
    // What is left is one empty block. Make it a paragraph, so new text never lands in a heading, quote or list.
    const anchor = document.getSelection()?.anchorNode
    const left = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest('h1, h2, blockquote, pre, li')
    if (left && node.contains(left)) {
      if (left.closest('ul')) document.execCommand('insertUnorderedList')
      document.execCommand('formatBlock', false, 'p')
    }
    sync()
  }

  function format(kind: Format): void {
    area.current?.focus()
    if (kind === 'heading') document.execCommand('formatBlock', false, 'h2')
    else if (kind === 'quote') document.execCommand('formatBlock', false, 'blockquote')
    else if (kind === 'list') document.execCommand('insertUnorderedList')
    else if (kind === 'code') {
      const selection = document.getSelection()
      if (selection && !selection.isCollapsed) {
        const box = document.createElement('div')
        box.append(selection.getRangeAt(0).cloneContents())
        // Without the trailing zero width space, Chrome and Safari flatten `code` to a styled span.
        document.execCommand('insertHTML', false, `<code>${inlineHtml(box)}</code>${ZERO_WIDTH}`)
      }
    } else document.execCommand(kind)
    sync()
  }

  function applyLink(): void {
    const href = safeUrl(url.trim())
    const selection = document.getSelection()
    if (saved.current && selection) { selection.removeAllRanges(); selection.addRange(saved.current) }
    if (href) document.execCommand('createLink', false, href)
    setLinking(false)
    setUrl('')
    sync()
  }

  function startLink(): void {
    const selection = document.getSelection()
    if (!selection || !selection.rangeCount || selection.isCollapsed) return
    saved.current = selection.getRangeAt(0).cloneRange()
    setLinking(true)
  }

  function insertBlock(tag: (typeof BLOCKS)[number]['tag'] | 'h1'): void {
    const selection = document.getSelection()
    const block = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement
    const line = block?.closest('p, h1, h2, blockquote, pre, li')
    const node = area.current
    setSlash(null)
    if (!line || !node || !selection) return
    node.focus()
    // The typed command goes and the block changes through the editing commands, so Undo steps back through both.
    const range = document.createRange()
    range.selectNodeContents(line)
    selection.removeAllRanges()
    selection.addRange(range)
    if (!range.collapsed) document.execCommand('delete')
    // insertHTML, because insertUnorderedList nests the list inside the paragraph.
    if (tag === 'ul') { if (!line.closest('ul')) document.execCommand('insertHTML', false, '<ul><li><br></li></ul>') }
    else {
      if (line.closest('ul')) document.execCommand('insertUnorderedList')
      document.execCommand('formatBlock', false, tag)
    }
    sync()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); format('bold'); return }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); format('italic'); return }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); startLink(); return }
    if (!slash || !matches.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const by = e.key === 'ArrowDown' ? 1 : -1
      setSlash({ ...slash, active: (slash.active + by + Math.max(1, matches.length)) % Math.max(1, matches.length) })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const block = matches[slash.active]
      if (block) insertBlock(block.tag)
    } else if (e.key === 'Escape') { e.preventDefault(); setSlash(null) }
  }

  function onInput(): void {
    sync()
    const selection = document.getSelection()
    const anchor = selection?.anchorNode
    const element = anchor instanceof Element ? anchor : anchor?.parentElement
    const line = element?.closest('p, h1, h2, blockquote, li')
    const text = line?.textContent ?? ''
    // Markdown shortcuts, typed at the start of an empty line.
    if (line && text.startsWith('/')) {
      const rect = line.getBoundingClientRect()
      const host = shell.current?.getBoundingClientRect()
      if (host) setSlash({ x: rect.left - host.left, y: rect.bottom - host.top + 4, query: text.slice(1), active: 0 })
    } else setSlash(null)
    if (line?.tagName === 'P' && /^(#|##|-|>)[ \u00a0]$/.test(text)) {
      const marker = text.trim()
      const tag = marker === '#' ? 'h1' : marker === '##' ? 'h2' : marker === '-' ? 'ul' : 'blockquote'
      insertBlock(tag)
    }
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>): void {
    // Plain text only: pasted markup never reaches the document.
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    // A drag inside the editor only moves text that is already here.
    if (movingText.current) return
    // Plain text only, like paste: dropped markup never reaches the document.
    e.preventDefault()
    const text = e.dataTransfer.getData('text/plain')
    if (!text) return
    area.current?.focus()
    const spot = document.caretPositionFromPoint?.(e.clientX, e.clientY)
    if (spot) document.getSelection()?.collapse(spot.offsetNode, spot.offset)
    document.execCommand('insertText', false, text)
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(out[tab])
    } catch {
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_HOLD_MS)
  }

  const empty = out.words === 0
  const tools = (size: 'sm' | 'md'): ReactNode => (
    <>
      {FORMATS.map(({ kind, label: name, icon }) => <IconButton key={kind} variant="ghost" size={size} icon={icon} label={name} animated={animated} aria-pressed={(kind === 'bold' || kind === 'italic') && Boolean(bar) && document.queryCommandState(kind)} onClick={() => format(kind)} />)}
      <IconButton variant="ghost" size={size} icon={<LinkIcon />} label="Link" animated={animated} onClick={startLink} />
    </>
  )
  return (
    <div ref={shell} className={cx(styles.tray, className)} data-still={still ? '' : undefined}>
      <div className={styles.toolbar}>
        <IconButton variant="ghost" size="sm" icon={<UndoIcon />} label="Undo" animated={animated} onClick={() => history('undo')} />
        <IconButton variant="ghost" size="sm" icon={<RedoIcon />} label="Redo" animated={animated} onClick={() => history('redo')} />
        <IconButton variant="ghost" size="sm" icon={<RotateCcwIcon />} label="Clear" animated={animated} disabled={empty} onClick={clearAll} />
        <span className={styles.count}><RollingText value={String(out.words)} still={still} /> WORDS</span>
      </div>
      <div className={styles.split}>
        <div className={styles.editor}>
          <div
            ref={area}
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            aria-placeholder={placeholder}
            contentEditable
            suppressContentEditableWarning
            className={styles.area}
            data-empty={empty ? '' : undefined}
            data-placeholder={placeholder}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onDragStart={() => { movingText.current = true }}
            onDragEnd={() => { movingText.current = false }}
            onDrop={onDrop}
            onBlur={() => setSlash(null)}
          >
            {first.current ?? <p><br /></p>}
          </div>
        </div>
        {source ? (
          <aside className={styles.source} aria-label="Source">
            <div className={styles.sourceBar}>
              <div role="tablist" aria-label="Format" className={styles.tabs}>
                {(['markdown', 'html'] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={styles.tab} onClick={() => setTab(name)}>{name === 'markdown' ? 'Markdown' : 'HTML'}</button>)}
              </div>
              <Button variant="ghost" size="sm" animated={animated} disabled={empty} leadingIcon={copied ? <Tick02Icon /> : <CopyIcon />} aria-label={copied ? 'Copied' : `Copy ${tab}`} onClick={() => void copy()}><LabelSwap swapKey={copied ? 'y' : 'n'} still={still}>{copied ? 'Copied' : 'Copy'}</LabelSwap></Button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.pre key={tab} tabIndex={0} className={styles.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : 0.12 }}>{empty ? 'Nothing to export yet.' : out[tab]}</motion.pre>
            </AnimatePresence>
          </aside>
        ) : null}
      </div>
      <div role="toolbar" aria-label="Format blocks" className={styles.row} onPointerDown={(e) => e.preventDefault()}>{tools('md')}</div>
      <AnimatePresence>
        {bar ? (
          <motion.div
            role="toolbar"
            aria-label="Format"
            className={styles.bar}
            style={{ left: bar.x, top: bar.y }}
            initial={still ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: still ? 0 : BAR_S, ease: ease.out }}
            onPointerDown={(e) => { if (!linking) e.preventDefault() }}
          >
            {linking ? (
              <form className={styles.link} onSubmit={(e) => { e.preventDefault(); applyLink() }}><input autoFocus type="url" aria-label="Link address" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setLinking(false) }} /></form>
            ) : (
              <>
                {tools('sm')}
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {slash && matches.length ? (
          <motion.ul role="listbox" aria-label="Blocks" className={styles.menu} style={{ left: slash.x, top: slash.y }} initial={still ? { opacity: 0 } : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : MENU_S, ease: ease.out }} onPointerDown={(e) => e.preventDefault()}>
            {matches.map((block, i) => (
              <li key={block.tag} role="option" aria-selected={i === slash.active} className={styles.option} onClick={() => insertBlock(block.tag)}>
                <span className={styles.tile}>{block.name.slice(0, 1)}</span>
                <span><span className={styles.optionName}>{block.name}</span><span className={styles.optionHint}>{block.hint}</span></span>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
