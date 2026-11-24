import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, useColors, type Colors } from '../kit'
import { Button, withInk } from './button'
import { type RenderIcon, type, useThemed } from './card'
import { Modal, ModalGrabber, type ModalMotion } from './dialog'
import { IconButton } from './icon-button'
import { EASE_OUT, useCompact } from './popover'
import { Switch } from './switch'

/** Popover opens in 180 ms, and the sheet on phones slides up in 280 ms. Both leave in the close time. */
const OPEN_MS = 180
const SHEET_MS = 280
const CLOSE_MS = 180
const POPOVER_SCALE = 0.98
const CLOSE = { duration: CLOSE_MS, easing: EASE_OUT }
const POSE_SHEET: ModalMotion = { from: { opacity: 0, yShare: 1 }, exit: { opacity: 0, yShare: 1 }, open: { duration: SHEET_MS, easing: EASE_OUT }, close: CLOSE }
const POSE_POPOVER: ModalMotion = { from: { opacity: 0, scale: POPOVER_SCALE }, exit: { opacity: 0, scale: POPOVER_SCALE }, open: { duration: OPEN_MS, easing: EASE_OUT }, close: CLOSE }
const DRAG = { closeAt: 0.3, velocity: 600 }
const WIDTH = 420

export type CookieCategory = {
  id: string
  title: string
  description: string
  /** Cannot be turned off. Shows the Always on chip. */
  locked?: boolean
}

export const COOKIE_CATEGORIES: CookieCategory[] = [
  { id: 'necessary', title: 'Strictly necessary', description: 'Sign in, security and your cart. The app can\'t work without these.', locked: true },
  { id: 'preferences', title: 'Preferences', description: 'Remember your language, region and display settings.' },
  { id: 'analytics', title: 'Analytics', description: 'Count visits and see which pages help, only in aggregate.' },
  { id: 'marketing', title: 'Marketing', description: 'Measure campaigns and show relevant ads on other sites.' },
]

/** The ids that are on. */
export type CookieChoices = string[]

export type CookiePreferencesPanelProps = {
  title?: ReactNode
  description?: ReactNode
  categories?: CookieCategory[]
  /** Optional ids that start on. Optional cookies start off. */
  defaultValue?: CookieChoices
  /** Runs for Save, Reject all and Accept all. Every action holds until the promise settles. */
  onSave?: (choices: CookieChoices) => Promise<void> | void
  /** Shows the close Icon Button. */
  onClose?: () => void
  /** Holds every action, for when saving is controlled outside. */
  saving?: boolean
  /** Draws the focus ring on one category, for specimens. */
  focusCategory?: string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** The panel inside Cookie Preferences: categories in an inset card, with Save counting the choices. */
export function CookiePreferencesPanel({ title = 'Cookie preferences', description = 'Choose which optional cookies we can use. You can change this any time.', categories = COOKIE_CATEGORIES, defaultValue = [], onSave, onClose, saving = false, focusCategory, renderIcon, animated = true, style }: CookiePreferencesPanelProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const compact = useCompact()
  const [on, setOn] = useState<CookieChoices>(defaultValue)
  const [busy, setBusy] = useState(false)
  const holding = saving || busy
  // Which button started the save, so only that one spins.
  const [pressed, setPressed] = useState<'reject' | 'accept' | 'save'>('save')
  const optional = categories.filter(({ locked }) => !locked).map(({ id }) => id)
  const locked = categories.filter((item) => item.locked).map(({ id }) => id)

  async function save(next: CookieChoices): Promise<void> {
    if (holding) return
    setBusy(true)
    try {
      await onSave?.([...locked, ...next])
    } finally {
      setBusy(false)
    }
  }

  const count = on.length
  const saveLabel = count === 0 ? 'Save choices' : `Save ${count} ${count === 1 ? 'choice' : 'choices'}`
  const size = compact ? 'md' : 'sm'
  const reject = <Button style={compact ? styles.half : undefined} variant="secondary" size={size} shape="pill" disabled={holding && pressed !== 'reject'} status={holding && pressed === 'reject' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onPress={() => { setPressed('reject'); void save([]) }}>Reject all</Button>
  const accept = <Button style={compact ? styles.half : undefined} variant="secondary" size={size} shape="pill" disabled={holding && pressed !== 'accept'} status={holding && pressed === 'accept' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onPress={() => { setPressed('accept'); void save(optional) }}>Accept all</Button>
  const keep = <Button style={styles.save} size={size} shape="pill" disabled={holding && pressed !== 'save'} status={holding && pressed === 'save' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onPress={() => { setPressed('save'); void save(on) }}>{saveLabel}</Button>

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {onClose ? <IconButton variant="ghost" size="sm" icon={renderIcon('x', 16)} label="Close" disabled={holding} animated={animated} onPress={onClose} /> : null}
      </View>
      <Text style={styles.intro}>{description}</Text>
      <View style={styles.list}>
        {categories.map((item, index) => (
          <View key={item.id} style={[styles.row, index < categories.length - 1 && styles.rowRule]}>
            <View style={styles.text}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowText}>{item.description}</Text>
            </View>
            {item.locked ? (
              <View style={styles.always}>{withInk(renderIcon('lock', 12), colors.textSecondary)}<Text style={styles.alwaysText}>Always on</Text></View>
            ) : (
              <View style={focusCategory === item.id ? styles.focusRing : undefined}>
                <Switch
                  accessibilityLabel={`${item.title}. ${item.description}`}
                  checked={on.includes(item.id)}
                  disabled={holding}
                  animated={animated}
                  onCheckedChange={(checked) => setOn(checked ? [...on, item.id] : on.filter((key) => key !== item.id))}
                />
              </View>
            )}
          </View>
        ))}
      </View>
      {compact ? (
        <View style={styles.footerStacked}>
          {keep}
          <View style={styles.footer}>{reject}{accept}</View>
        </View>
      ) : <View style={styles.footer}>{reject}{accept}{keep}</View>}
    </View>
  )
}

export type CookiePreferencesProps = Omit<CookiePreferencesPanelProps, 'onClose' | 'focusCategory' | 'saving'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires once it has fully closed. */
  onClosed?: () => void
}

/** A dialog on the panel: a bottom sheet on phones and a centred panel on tablets. */
export function CookiePreferences({ open, onOpenChange, onClosed, onSave, animated = true, style, ...panel }: CookiePreferencesProps) {
  const [saving, setSaving] = useState(false)
  const closed = useRef(onClosed)
  closed.current = onClosed
  const wasOpen = useRef(open)

  useEffect(() => {
    if (open || !wasOpen.current) { wasOpen.current = open; return undefined }
    wasOpen.current = false
    const timer = setTimeout(() => closed.current?.(), animated ? CLOSE_MS : 0)
    return () => clearTimeout(timer)
  }, [animated, open])

  async function save(choices: CookieChoices): Promise<void> {
    setSaving(true)
    try {
      await onSave?.(choices)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onDismiss={() => { if (!saving) onOpenChange(false) }}
      label="Cookie preferences"
      placement="center"
      mobilePlacement="bottom"
      pose={(mobile) => (mobile ? POSE_SHEET : POSE_POPOVER)}
      drag={saving ? false : DRAG}
      locked={saving}
      animated={animated}
      width={WIDTH}
    >
      <ModalGrabber />
      <CookiePreferencesPanel {...panel} onSave={save} onClose={() => onOpenChange(false)} animated={animated} style={style} />
    </Modal>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, gap: space[1], padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 28, paddingLeft: space[3.5], paddingRight: space[1.5], paddingTop: space[2] },
  title: { ...type(16, c.textPrimary, '600'), flexShrink: 1, lineHeight: 20 },
  intro: { ...type(14, c.textSecondary), lineHeight: 20, paddingBottom: space[2], paddingHorizontal: space[3.5] },
  list: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space[3.5], paddingVertical: space[1] },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[4], justifyContent: 'space-between', paddingVertical: space[3] },
  rowRule: { borderBottomColor: c.ink8, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: space[0.5], minWidth: 0 },
  rowTitle: type(14, c.textPrimary, '500'),
  rowText: type(12, c.textSecondary),
  always: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', flexShrink: 0, gap: space[1], paddingHorizontal: space[2], paddingVertical: space[1] },
  alwaysText: type(12, c.textSecondary, '500'),
  focusRing: { borderColor: c.textPrimary, borderRadius: radius.full, borderWidth: 2, padding: space[0.5] },
  footer: { flexDirection: 'row', gap: space[1.5], paddingBottom: space[1], paddingHorizontal: space[1], paddingTop: space[1.5] },
  footerStacked: { gap: space[1.5] },
  half: { flex: 1 },
  save: { flex: 1 },
})
