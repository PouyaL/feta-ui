import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputInstance, type TextInputKeyPressEvent, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated'
import { currentState, font, pressedState, radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT, LabelSwap, withInk, SELF } from './button'
import { useStill, useThemed, type RenderIcon } from './card'
import { IconButton } from './icon-button'

// Core React Native has no rich text field, so the document is a list of blocks, one field each, and inline marks
// are Markdown typed into the text: **bold**, *italic*, `code` and [links](https://...). The toolbar wraps the
// selection in those marks, and the export turns them into clean Markdown and HTML, as the web editor does.

const WEB_FIELD = Platform.OS === 'web'
const MENU_MS = 160
const BAR_MS = 140
const HISTORY = 100

export type RichBlockKind = 'p' | 'h1' | 'h2' | 'li' | 'quote' | 'code'
export type RichBlock = { kind: RichBlockKind; text: string }

const BLOCKS: { name: string; hint: string; kind: RichBlockKind }[] = [
  { name: 'Heading', hint: 'Big section title', kind: 'h2' },
  { name: 'Bulleted list', hint: 'A simple list', kind: 'li' },
  { name: 'Quote', hint: 'Call out a note', kind: 'quote' },
  { name: 'Code block', hint: 'Monospaced snippet', kind: 'code' },
]
type Format = 'bold' | 'italic' | 'code' | 'heading' | 'quote' | 'list'
const FORMATS: { kind: Format; label: string; icon: string }[] = [
  { kind: 'bold', label: 'Bold', icon: 'text-bold' },
  { kind: 'italic', label: 'Italic', icon: 'text-italic' },
  { kind: 'code', label: 'Code', icon: 'source-code' },
  { kind: 'heading', label: 'Heading', icon: 'heading' },
  { kind: 'quote', label: 'Quote', icon: 'quote-down' },
  { kind: 'list', label: 'Bulleted list', icon: 'left-to-right-list-bullet' },
]
const WRAP: Record<'bold' | 'italic' | 'code', string> = { bold: '**', italic: '*', code: '`' }
const SHORTCUT: Record<string, RichBlockKind> = { '# ': 'h1', '## ': 'h2', '- ': 'li', '> ': 'quote' }

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeUrl = (href: string): string => (/^(https?:|mailto:)/i.test(href) ? href : '')

/** Inline Markdown to HTML. Only known marks and safe links survive; everything else is escaped text. */
function inlineHtml(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => (safeUrl(href) ? `<a href="${href}">${label}</a>` : label))
}

/** Unsafe links lose their address in the Markdown too. */
const inlineMarkdown = (text: string): string => text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => (safeUrl(href) ? whole : label))

/** Consecutive list items form one list. */
function groups(blocks: RichBlock[]): RichBlock[][] {
  const out: RichBlock[][] = []
  for (const block of blocks) {
    const last = out[out.length - 1]
    if (block.kind === 'li' && last?.[0]?.kind === 'li') last.push(block)
    else out.push([block])
  }
  return out
}

export function toMarkdown(blocks: RichBlock[]): string {
  return groups(blocks.filter((block) => block.text.trim() || block.kind === 'code')).map((group) => {
    const first = group[0] as RichBlock
    if (first.kind === 'li') return group.map((item) => `- ${inlineMarkdown(item.text)}`).join('\n')
    if (first.kind === 'h1') return `# ${inlineMarkdown(first.text)}`
    if (first.kind === 'h2') return `## ${inlineMarkdown(first.text)}`
    if (first.kind === 'quote') return `> ${inlineMarkdown(first.text)}`
    if (first.kind === 'code') return `\`\`\`\n${first.text}\n\`\`\``
    return inlineMarkdown(first.text)
  }).join('\n\n')
}

export function toHtml(blocks: RichBlock[]): string {
  return groups(blocks.filter((block) => block.text.trim() || block.kind === 'code')).map((group) => {
    const first = group[0] as RichBlock
    if (first.kind === 'li') return `<ul>\n${group.map((item) => `  <li>${inlineHtml(item.text)}</li>`).join('\n')}\n</ul>`
    if (first.kind === 'code') return `<pre><code>${escapeHtml(first.text)}</code></pre>`
    const tag = first.kind === 'quote' ? 'blockquote' : first.kind
    return `<${tag}>${inlineHtml(first.text)}</${tag}>`
  }).join('\n')
}

const countWords = (blocks: RichBlock[]): number => {
  const text = blocks.map((block) => block.text.replace(/[*`[\]]|\(([^)\s]+)\)/g, ' ')).join(' ').trim()
  return text ? text.split(/\s+/).length : 0
}

type Span = { text: string; mark?: 'bold' | 'italic' | 'code' | 'link' | 'syntax' }

/** Splits a block's text into marks and the Markdown syntax around them, for drawing it formatted. */
function spans(text: string): Span[] {
  const out: Span[] = []
  const pattern = /(`)([^`]+)(`)|(\*\*)([^*]+)(\*\*)|(\*)([^*]+)(\*)|(\[)([^\]]+)(\]\([^)\s]+\))/g
  let at = 0
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) })
    const [open, body, close, mark] = m[1] ? [m[1], m[2], m[3], 'code' as const] : m[4] ? [m[4], m[5], m[6], 'bold' as const] : m[7] ? [m[7], m[8], m[9], 'italic' as const] : [m[10], m[11], m[12], 'link' as const]
    out.push({ text: open ?? '', mark: 'syntax' }, { text: body ?? '', mark }, { text: close ?? '', mark: 'syntax' })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}

const MARK_STYLE = { bold: (s: Styles) => s.markBold, italic: (s: Styles) => s.markItalic, code: (s: Styles) => s.markCode, link: (s: Styles) => s.markLink }
type Styles = ReturnType<typeof createStyles>

export type RichTextEditorProps = {
  /** The first content, as blocks. Read once. */
  defaultValue?: RichBlock[]
  label?: string
  placeholder?: string
  /** Fires with the export on every change, and once on mount for the starting content. */
  onChange?: (value: { markdown: string; html: string }) => void
  /** Draws the toolbar icons by name: `undo`, `redo`, `rotate-ccw`, `link` and the format icons. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Short structured writing that exports clean Markdown and HTML. */
export function RichTextEditor({ defaultValue, label = 'Editor', placeholder = 'Start writing, or type / for blocks', onChange, renderIcon, animated = true, style }: RichTextEditorProps) {
  const s = useThemed(createStyles)
  const c = useColors()
  const still = useStill(animated)
  const [blocks, setBlocks] = useState<RichBlock[]>(() => (defaultValue?.length ? defaultValue : [{ kind: 'p', text: '' }]))
  const [past, setPast] = useState<RichBlock[][]>([])
  const [future, setFuture] = useState<RichBlock[][]>([])
  const [focus, setFocus] = useState(0)
  const [editing, setEditing] = useState<number | null>(null)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [linking, setLinking] = useState(false)
  const [url, setUrl] = useState('')
  const [slashActive, setSlashActive] = useState(0)
  const fields = useRef<(TextInputInstance | null)[]>([])
  const pendingFocus = useRef<number | null>(null)
  const words = countWords(blocks)
  const empty = words === 0
  const current = blocks[focus]
  const slashQuery = current && current.kind === 'p' && current.text.startsWith('/') && !current.text.includes(' ') ? current.text.slice(1) : null
  const matches = slashQuery === null ? [] : BLOCKS.filter((block) => block.name.toLowerCase().includes(slashQuery.toLowerCase()))

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })
  useEffect(() => { onChangeRef.current?.({ markdown: toMarkdown(blocks), html: toHtml(blocks) }) }, [blocks])
  useEffect(() => {
    if (pendingFocus.current === null) return
    fields.current[pendingFocus.current]?.focus()
    pendingFocus.current = null
  })
  useEffect(() => { setSlashActive(0) }, [slashQuery])

  /** Every edit goes through here, so Undo steps back through it. */
  function commit(next: RichBlock[], focusAt?: number): void {
    setPast((list) => [...list.slice(-HISTORY + 1), blocks])
    setFuture([])
    setBlocks(next)
    if (focusAt !== undefined) { setFocus(focusAt); pendingFocus.current = focusAt }
  }
  const replace = (index: number, block: RichBlock): RichBlock[] => blocks.map((item, i) => (i === index ? block : item))

  function history(direction: 'undo' | 'redo'): void {
    const from = direction === 'undo' ? past : future
    const to = from[from.length - 1]
    if (!to) return
    if (direction === 'undo') { setPast(from.slice(0, -1)); setFuture((list) => [...list, blocks]) } else { setFuture(from.slice(0, -1)); setPast((list) => [...list, blocks]) }
    setBlocks(to)
    setFocus((at) => Math.min(at, to.length - 1))
  }

  function clearAll(): void { commit([{ kind: 'p', text: '' }], 0) }

  function onText(index: number, text: string): void {
    const block = blocks[index]
    if (!block) return
    // Markdown shortcuts, typed at the start of an empty paragraph.
    const kind = block.kind === 'p' ? SHORTCUT[text] : undefined
    if (kind) { commit(replace(index, { kind, text: '' })); return }
    // Return ends the block, except in code. An empty list item ends the list.
    const at = text.indexOf('\n')
    if (at >= 0 && block.kind !== 'code') {
      if (block.kind === 'li' && !text.replace('\n', '').trim()) { commit(replace(index, { kind: 'p', text: '' }), index); return }
      const next: RichBlock = { kind: block.kind === 'li' ? 'li' : 'p', text: text.slice(at + 1).replace(/\n/g, ' ') }
      commit([...blocks.slice(0, index), { ...block, text: text.slice(0, at) }, next, ...blocks.slice(index + 1)], index + 1)
      return
    }
    commit(replace(index, { ...block, text }))
  }

  function onKey(index: number, event: TextInputKeyPressEvent): void {
    const key = event.nativeEvent.key
    const block = blocks[index]
    // Backspace in an empty block joins it to the one above.
    if (key === 'Backspace' && block && !block.text && index > 0) {
      if (block.kind !== 'p') { commit(replace(index, { kind: 'p', text: '' })); return }
      commit(blocks.filter((_, i) => i !== index), index - 1)
      return
    }
    if (!matches.length || index !== focus) return
    if (key === 'ArrowDown') setSlashActive((n) => (n + 1) % matches.length)
    else if (key === 'ArrowUp') setSlashActive((n) => (n - 1 + matches.length) % matches.length)
    else if (key === 'Enter') { const pick = matches[slashActive]; if (pick) insertBlock(pick.kind) }
    else if (key === 'Escape') commit(replace(index, { kind: 'p', text: '' }))
  }

  function insertBlock(kind: RichBlockKind): void {
    commit(replace(focus, { kind, text: '' }), focus)
  }

  function format(kind: Format): void {
    const block = blocks[focus]
    if (!block) return
    if (kind === 'heading' || kind === 'quote' || kind === 'list') {
      const to: RichBlockKind = kind === 'heading' ? 'h2' : kind === 'quote' ? 'quote' : 'li'
      commit(replace(focus, { ...block, kind: block.kind === to ? 'p' : to }), focus)
      return
    }
    const mark = WRAP[kind]
    const { start, end } = selection
    // Code needs a selection, as on the web. Bold and italic open an empty pair at the caret.
    if (start === end && kind === 'code') return
    const text = `${block.text.slice(0, start)}${mark}${block.text.slice(start, end)}${mark}${block.text.slice(end)}`
    commit(replace(focus, { ...block, text }), focus)
    setSelection({ start: start + mark.length, end: end + mark.length })
  }

  function startLink(): void {
    if (selection.start === selection.end) return
    setLinking(true)
  }
  function applyLink(): void {
    const href = safeUrl(url.trim())
    const block = blocks[focus]
    if (href && block) {
      const { start, end } = selection
      commit(replace(focus, { ...block, text: `${block.text.slice(0, start)}[${block.text.slice(start, end)}](${href})${block.text.slice(end)}` }), focus)
    }
    setLinking(false)
    setUrl('')
  }

  const icon = (name: string): ReactNode => (renderIcon ? withInk(renderIcon(name, 20), c.textSecondary) : null)
  return (
    <View style={[s.tray, style]}>
      <View style={s.toolbar}>
        <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('undo')} label="Undo" animated={animated} disabled={!past.length} aria-disabled={!past.length} onPress={() => history('undo')} />
        <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('redo')} label="Redo" animated={animated} disabled={!future.length} aria-disabled={!future.length} onPress={() => history('redo')} />
        <IconButton style={SELF.center} variant="ghost" size="sm" icon={icon('rotate-ccw')} label="Clear" animated={animated} disabled={empty} aria-disabled={empty} onPress={clearAll} />
        <View style={s.count} accessible aria-label={`${words} words`}>
          <LabelSwap swapKey={String(words)} still={still}><Text style={s.countText}>{words}</Text></LabelSwap>
          <Text style={s.countText}> WORDS</Text>
        </View>
      </View>
      <View style={s.editor} role="group" aria-label={label}>
        {blocks.map((block, i) => (
          <View key={i} style={[s.block, block.kind === 'quote' && s.quote, block.kind === 'code' && s.code, block.kind === 'li' && s.li, block.kind === 'li' && blocks[i + 1]?.kind === 'li' && s.liRun, block.kind === 'h1' && s.h1Block, block.kind === 'h2' && s.h2Block]}>
            {block.kind === 'li' ? <Text aria-hidden style={s.bullet}>•</Text> : null}
            <TextInput
              ref={(node) => { fields.current[i] = node }}
              multiline
              accessibilityLabel={i === 0 ? label : `${label}, block ${i + 1}`}
              placeholder={i === 0 && blocks.length === 1 && empty ? placeholder : undefined}
              placeholderTextColor={c.textTertiary}
              scrollEnabled={false}
              selectionColor={c.textPrimary}
              style={[s.field, block.kind === 'h1' && s.h1, block.kind === 'h2' && s.h2, block.kind === 'quote' && s.quoteText, block.kind === 'code' && s.codeText]}
              // iOS and Android draw the text formatted: bold, italic, code and links, with the Markdown marks hidden
              // and shown faintly only in the block being edited. The web field keeps plain text.
              {...(WEB_FIELD ? { value: block.text } : {})}
              onChangeText={(text) => onText(i, text)}
              onFocus={() => { setFocus(i); setEditing(i) }}
              onBlur={() => setEditing((at) => (at === i ? null : at))}
              onKeyPress={(event) => onKey(i, event)}
              onSelectionChange={(event) => { if (i === focus) setSelection(event.nativeEvent.selection) }}
            >
              {WEB_FIELD || block.kind === 'code' ? undefined : spans(block.text).map((span, n) => <Text key={n} style={span.mark ? (span.mark === 'syntax' ? (editing === i ? s.syntax : s.hidden) : MARK_STYLE[span.mark](s)) : undefined}>{span.text}</Text>)}
              {!WEB_FIELD && block.kind === 'code' ? block.text : undefined}
            </TextInput>
          </View>
        ))}
        {matches.length ? (
          <Animated.View {...(still ? {} : { entering: FadeInUp.duration(MENU_MS).easing(EASE_OUT), exiting: FadeOut.duration(MENU_MS) })} role="menu" aria-label="Blocks" style={s.menu}>
            {matches.map((block, n) => (
              <Pressable key={block.kind} role="menuitem" {...currentState(n === slashActive)} style={({ pressed }) => [s.option, (pressed || n === slashActive) && s.optionOn]} onPress={() => insertBlock(block.kind)}>
                <View style={s.tile}><Text style={s.tileText}>{block.name.slice(0, 1)}</Text></View>
                <View><Text style={s.optionName}>{block.name}</Text><Text style={s.optionHint}>{block.hint}</Text></View>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}
      </View>
      {linking ? (
        <Animated.View {...(still ? {} : { entering: FadeIn.duration(BAR_MS).easing(EASE_OUT) })} style={s.link}>
          <TextInput
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Link address"
            keyboardType="url"
            placeholder="https://"
            placeholderTextColor={c.textTertiary}
            returnKeyType="done"
            style={s.linkField}
            value={url}
            onChangeText={setUrl}
            onKeyPress={(event) => { if (event.nativeEvent.key === 'Escape') setLinking(false) }}
            onSubmitEditing={applyLink}
          />
        </Animated.View>
      ) : null}
      <View role="toolbar" aria-label="Format blocks" style={s.row}>
        {FORMATS.map(({ kind, label: name, icon: glyph }) => {
          const on = (kind === 'heading' && current?.kind === 'h2') || (kind === 'quote' && current?.kind === 'quote') || (kind === 'list' && current?.kind === 'li')
          return <IconButton style={SELF.center} key={kind} variant="ghost" size="md" icon={icon(glyph)} label={name} {...pressedState(on)} animated={animated} onPress={() => format(kind)} />
        })}
        <IconButton style={SELF.center} variant="ghost" size="md" icon={icon('link')} label="Link" animated={animated} onPress={startLink} />
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => {
  const sans = (size: number, lineHeight: number, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({ fontFamily: font.sans, fontSize: size, fontWeight: weight, letterSpacing: font.tracking(size), lineHeight })
  return StyleSheet.create({
    tray: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1], width: '100%' },
    toolbar: { alignItems: 'center', flexDirection: 'row', minHeight: 44, paddingHorizontal: space[1] },
    count: { alignItems: 'center', flexDirection: 'row', marginLeft: 'auto', paddingRight: space[2] },
    countText: { color: c.textTertiary, fontFamily: font.mono, fontSize: 11, lineHeight: 16 },
    editor: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, minHeight: 240, paddingHorizontal: space[4.5], paddingVertical: space[5] },
    block: { flexDirection: 'row', marginBottom: space[2] },
    field: { ...sans(16, 24), color: c.textPrimary, flex: 1, padding: 0, textAlignVertical: 'top' },
    h1: { ...sans(22, 28, '600') },
    h2: { ...sans(19, 26, '600') },
    h1Block: { marginBottom: space[2] },
    h2Block: { marginBottom: space[1.5], marginTop: space[2] },
    li: { paddingLeft: space[1] },
    liRun: { marginBottom: 0 },
    quote: { borderLeftColor: c.ink10, borderLeftWidth: 2, marginTop: space[1], paddingLeft: space[3] },
    code: { backgroundColor: c.ink4, borderRadius: radius.field, padding: space[3] },
    quoteText: { color: c.textSecondary },
    codeText: { fontFamily: font.mono, fontSize: 13, letterSpacing: 0, lineHeight: 20 },
    bullet: { ...sans(20, 24), color: c.textPrimary, width: space[4] },
    markBold: { fontWeight: '700' },
    markItalic: { fontStyle: 'italic' },
    markCode: { backgroundColor: c.ink5, fontFamily: font.mono, fontSize: 13, letterSpacing: 0 },
    markLink: { color: c.accent, textDecorationLine: 'underline' },
    syntax: { color: c.textQuaternary },
    // Marks outside the edited block take no room: transparent and a hair wide.
    hidden: { color: 'transparent', fontSize: 1, letterSpacing: 0 },
    menu: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.xl, borderWidth: 1, marginTop: space[1], padding: space[1] },
    option: { alignItems: 'center', borderRadius: radius.lg, flexDirection: 'row', gap: space[2.5], minHeight: 44, paddingHorizontal: space[2] },
    optionOn: { backgroundColor: c.ink5 },
    tile: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.md, height: 28, justifyContent: 'center', width: 28 },
    tileText: { ...sans(12, 16, '600'), color: c.textPrimary },
    optionName: { ...sans(12, 16, '500'), color: c.textPrimary },
    optionHint: { ...sans(12, 16), color: c.textSecondary },
    link: { paddingHorizontal: space[2], paddingTop: space[1] },
    linkField: { ...sans(16, 22), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.field, borderWidth: 1, color: c.textPrimary, minHeight: 44, paddingHorizontal: space[3] },
    row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[0.5], paddingHorizontal: space[1], paddingTop: space[1] },
  })
}
