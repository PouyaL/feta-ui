import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, type DimensionValue, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, FadeOutUp, LinearTransition, ZoomIn, ZoomOut, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors, hscroll } from '../kit'
import { Button, withInk, SELF } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { iconFor } from './label'
import { Spinner } from './spinner'

const SHAKE_MS = 360
const SWEEP_MS = 1200
const BASE_MS = 200
const EXIT_MS = 180
const SWEEP_TRAVEL = 320
const ROW_SPRING = { stiffness: 320, damping: 30, mass: 1 } as const
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const SWEEP_EASE = Easing.bezier(0.42, 0, 0.58, 1)

const badgeIn = ZoomIn.springify().stiffness(420).damping(26).mass(1)
const rowMove = LinearTransition.springify().stiffness(ROW_SPRING.stiffness).damping(ROW_SPRING.damping).mass(ROW_SPRING.mass)

export type AttachmentType = 'file' | 'image' | 'pdf' | 'archive' | 'sheet' | 'code' | 'video' | 'audio'
export type AttachmentStatus = 'ready' | 'uploading' | 'processing' | 'error' | 'uploaded'

/** The tile glyph per type, as on the web, drawn through `renderIcon`. */
const GLYPH: Record<AttachmentType, string> = { file: 'file-text', image: 'image', pdf: 'file-text', archive: 'archive', sheet: 'table', code: 'file-text', video: 'file-video', audio: 'mic' }
/** Shown on the tile when the app passes neither `icon` nor `renderIcon`. */
const TAG: Record<AttachmentType, string> = { file: 'FILE', image: 'IMG', pdf: 'PDF', archive: 'ZIP', sheet: 'XLS', code: 'CODE', video: 'VID', audio: 'AUD' }
/** The web tile's gradient per type (top to bottom). File is the inverse ink and PDF solid danger. */
const TILE_GRADIENT: Partial<Record<AttachmentType, { from: string; to: string }>> = {
  archive: accent.amber, sheet: accent.emerald, code: accent.violet, audio: accent.orange, image: accent.sky, video: accent.sky,
}
/** The web's scrim over a tile while it uploads. */
const SCRIM = 'rgba(0,0,0,0.45)'

export type AttachmentProps = {
  name: string
  /** The meta line: a size, or a reason. */
  meta?: string
  type?: AttachmentType
  /** Replaces the type tag on the tile. */
  icon?: ReactNode
  status?: AttachmentStatus
  /** 0 to 100 while uploading. */
  progress?: number
  size?: 'default' | 'small' | 'xsmall'
  /** `vertical` is a 168 card with a 160 by 112 preview, and actions sit on the preview. */
  orientation?: 'horizontal' | 'vertical'
  onRemove?: () => void
  onRetry?: () => void
  onMore?: () => void
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Sweep({ still }: { still: boolean }) {
  const styles = useThemed(createStyles)
  const at = useSharedValue(-100)
  useEffect(() => {
    if (still) return
    at.value = withRepeat(withSequence(withTiming(-100, { duration: 0 }), withTiming(SWEEP_TRAVEL, { duration: SWEEP_MS, easing: SWEEP_EASE })), -1)
    return () => cancelAnimation(at)
  }, [still, at])
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: at.value }] }))
  return <Animated.View style={[styles.fill, styles.sweep, sweep]} />
}

/** A file on its way up or already there: a type tile, the name, a live status and actions. */
export function Attachment({ name, meta, type: kind = 'file', icon, status = 'ready', progress = 0, size = 'default', orientation = 'horizontal', onRemove, onRetry, onMore, renderIcon, animated = true, style }: AttachmentProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const x = useSharedValue(0)
  const busy = status === 'uploading' || status === 'processing'
  const vertical = orientation === 'vertical'
  const statusText = status === 'uploading' ? `Uploading, ${progress}%` : status === 'processing' ? 'Processing' : status === 'error' ? 'Upload failed' : status === 'uploaded' ? 'Uploaded' : meta
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const hasActions = Boolean(onRemove || (status === 'error' && onRetry) || (status === 'uploaded' && onMore))
  const width: DimensionValue = `${Math.min(100, Math.max(0, progress))}%`
  const gradient = TILE_GRADIENT[kind]
  const gradientId = `tile${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const glyphSize = vertical ? 28 : size === 'xsmall' ? 14 : 20
  // The tile keeps overflow visible for its badge, so the gradient draws its own corners.
  const tileRadius = vertical ? radius.xl : size === 'small' ? radius.field : size === 'xsmall' ? radius.lg : radius.xl

  useEffect(() => {
    if (status !== 'error' || still) return
    const leg = { duration: SHAKE_MS / 3, easing: OUT }
    x.value = withSequence(withTiming(4, leg), withTiming(-4, leg), withTiming(0, leg))
  }, [status, still, x])

  return (
    <Animated.View style={[styles.card, size === 'small' && styles.cardSmall, size === 'xsmall' && styles.cardTiny, vertical && styles.cardUp, status === 'error' && styles.cardError, shake, style]}>
      <View style={[styles.tile, kind === 'pdf' && styles.tilePdf, gradient && styles.tileClear, size === 'small' && styles.tileSmall, size === 'xsmall' && styles.tileTiny, vertical && styles.tileUp]}>
        {gradient ? (
          <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={gradient.from} />
                <Stop offset="1" stopColor={gradient.to} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx={tileRadius} fill={`url(#${gradientId})`} />
          </Svg>
        ) : null}
        {icon ?? (renderIcon ? withInk(renderIcon(GLYPH[kind], glyphSize), kind === 'file' ? colors.textInverse : colors.onSolid) : <Text style={[styles.tag, size === 'xsmall' && styles.tagTiny]}>{TAG[kind]}</Text>)}
        {status === 'uploading' ? <View style={styles.veil}><Spinner size={16} label={null} color={colors.textInverse} animated={animated} /></View> : null}
        {status === 'uploaded' || status === 'error' ? (
          <Animated.View key={status} {...(still ? {} : { entering: badgeIn })} style={[styles.badge, status === 'error' && styles.badgeError]}>
            {withInk(iconFor(renderIcon, status === 'uploaded' ? 'tick-02' : 'alert-circle', 10, colors.onSolid), colors.onSolid)}
          </Animated.View>
        ) : null}
      </View>
      <View style={[styles.text, vertical && styles.textUp]}>
        <Text numberOfLines={1} style={styles.name}>{name}</Text>
        {size === 'xsmall' || !statusText ? null : <Text accessibilityLiveRegion="polite" style={styles.meta}>{statusText}</Text>}
        {busy && size !== 'xsmall' ? (
          <View
            accessibilityLabel={`Upload of ${name}`}
            accessibilityRole="progressbar"
            {...(status === 'uploading' ? { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress } : { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuetext': 'Processing' })}
            style={styles.bar}
          >
            {status === 'uploading' ? <View style={[styles.fill, { width }]} /> : <Sweep still={still} />}
          </View>
        ) : null}
      </View>
      {hasActions ? (
        <View style={[styles.actions, vertical && styles.actionsUp]}>
          {status === 'error' && onRetry ? <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label={`Retry ${name}`} icon={iconFor(renderIcon, 'undo', 16, colors.textSecondary)} onPress={onRetry} /> : null}
          {status === 'uploaded' && onMore ? <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label={`More for ${name}`} icon={iconFor(renderIcon, 'more-horizontal', 16, colors.textSecondary)} onPress={onMore} /> : null}
          {onRemove ? <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label={`Remove ${name}`} icon={iconFor(renderIcon, 'x', 16, colors.textSecondary)} onPress={onRemove} /> : null}
        </View>
      ) : null}
    </Animated.View>
  )
}

export type UploadItem = AttachmentProps & { id: string }

const PAGE = 296
const CARD_WIDTH = 280
const GROUP_FADE = 56
const cardIn = ZoomIn.springify().stiffness(ROW_SPRING.stiffness).damping(ROW_SPRING.damping).mass(ROW_SPRING.mass).withInitialValues({ transform: [{ scale: 0.96 }] })
const cardOut = ZoomOut.duration(EXIT_MS)

export type AttachmentGroupProps = {
  items: UploadItem[]
  /** The row's accessible name. */
  label?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A row of small cards, as above a message composer. When it overflows it scrolls, fades, and offers a pager. */
export function AttachmentGroup({ items, label = 'Attachments', renderIcon, animated = true, style }: AttachmentGroupProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const row = useRef<ScrollViewInstance>(null)
  const [frame, setFrame] = useState(0)
  const [content, setContent] = useState(0)
  const [offset, setOffset] = useState(0)
  const fade = frame > 0 && offset + frame < content - 1

  return (
    <View role="group" aria-label={label} style={[styles.group, style]} onLayout={(e: LayoutChangeEvent) => setFrame(e.nativeEvent.layout.width)}>
      <ScrollView style={hscroll}
        ref={row}
        horizontal
        contentContainerStyle={styles.groupRow}
        decelerationRate="fast"
        scrollEventThrottle={32}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + space[2]}
        onContentSizeChange={(width) => setContent(width)}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => setOffset(e.nativeEvent.contentOffset.x)}
      >
        {items.map(({ id, ...item }) => (
          <Animated.View key={id} {...(still ? {} : { entering: cardIn, exiting: cardOut, layout: rowMove })} style={styles.groupCard}>
            <Attachment {...item} {...(renderIcon ? { renderIcon } : {})} size="small" animated={animated} />
          </Animated.View>
        ))}
      </ScrollView>
      {fade ? (
        <Animated.View {...(still ? {} : { entering: FadeIn.duration(BASE_MS), exiting: FadeOut.duration(BASE_MS) })} pointerEvents="box-none" style={styles.groupFade}>
          <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} width={GROUP_FADE} height="100%">
            <Defs>
              <LinearGradient id="attachment-fade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.canvas} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.canvas} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width={GROUP_FADE} height="100%" fill="url(#attachment-fade)" />
          </Svg>
          <IconButton style={SELF.end} variant="outline" size="sm" animated={animated} label="More attachments" icon={iconFor(renderIcon, 'arrow-right', 16, colors.textPrimary)} onPress={() => row.current?.scrollTo({ x: offset + PAGE, animated: !still })} />
        </Animated.View>
      ) : null}
    </View>
  )
}

export type FileUploadProps = {
  items?: UploadItem[]
  /** Opens the app's picker. Core React Native has no file picker and no drop target. */
  onBrowse?: () => void
  /** The limits line. */
  hint?: string
  footer?: ReactNode
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A browse zone and an upload queue. Rows fade in and fold away when removed. */
export function FileUpload({ items = [], onBrowse, hint = 'PNG, PDF or ZIP, up to 20 MB', footer, renderIcon, animated = true, style }: FileUploadProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  return (
    <View style={[styles.upload, style]}>
      <View style={[styles.zone, items.length > 0 && styles.zoneCompact]}>
        {iconFor(renderIcon, 'upload', 20, colors.textSecondary)}
        <View style={[styles.zoneText, items.length === 0 && styles.zoneTextCentered]}>
          <Text style={styles.name}>Add files</Text>
          <Text style={styles.meta}>{hint}</Text>
        </View>
        <Button size="sm" variant="secondary" animated={animated} style={items.length === 0 ? styles.centered : undefined} {...(onBrowse ? { onPress: onBrowse } : { disabled: true })}>Browse</Button>
      </View>
      <View>
        {items.map(({ id, ...item }) => (
          <Animated.View key={id} {...(still ? {} : { entering: FadeIn.duration(BASE_MS).delay(50), exiting: FadeOutUp.duration(EXIT_MS), layout: rowMove })} style={styles.row}>
            <Attachment {...item} {...(renderIcon ? { renderIcon } : {})} animated={animated} />
          </Animated.View>
        ))}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius['2xl'], borderWidth: 1, flexDirection: 'row', gap: space[3], minHeight: 64, padding: space[3], width: '100%' },
  cardSmall: { borderRadius: radius.control, minHeight: 52, padding: space[2] },
  cardTiny: { alignSelf: 'flex-start', borderRadius: radius.full, minHeight: 36, paddingHorizontal: space[1.5], paddingVertical: space[1], width: undefined },
  cardUp: { alignItems: 'stretch', flexDirection: 'column', gap: space[2], paddingBottom: space[2.5], paddingHorizontal: space[1], paddingTop: space[1], width: 168 },
  cardError: { borderColor: c.danger, borderWidth: 1.5 },
  tile: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.xl, height: 40, justifyContent: 'center', overflow: 'visible', width: 40 },
  tilePdf: { backgroundColor: c.danger },
  tileClear: { backgroundColor: 'transparent' },
  tileSmall: { borderRadius: radius.field, height: 32, width: 32 },
  tileTiny: { borderRadius: radius.lg, height: 24, width: 24 },
  tileUp: { height: 112, width: 160 },
  tag: type(10, c.textInverse, '500', true),
  tagTiny: { fontSize: 8 },
  veil: { ...StyleSheet.absoluteFill, alignItems: 'center', backgroundColor: SCRIM, borderRadius: radius.xl, justifyContent: 'center' },
  badge: { alignItems: 'center', backgroundColor: c.success, borderColor: c.surface, borderRadius: radius.full, borderWidth: 2, height: 20, justifyContent: 'center', position: 'absolute', right: -6, top: -6, width: 20 },
  badgeError: { backgroundColor: c.danger },
  text: { flex: 1, minWidth: 0 },
  textUp: { paddingHorizontal: space[1.5] },
  name: type(16, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  bar: { backgroundColor: c.ink8, borderRadius: radius.full, height: 3, marginTop: space[1], overflow: 'hidden' },
  fill: { backgroundColor: c.inverse, borderRadius: radius.full, height: '100%' },
  sweep: { width: '32%' },
  actions: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: space[0.5] },
  actionsUp: { backgroundColor: c.surface, borderRadius: radius.full, position: 'absolute', right: space[2], top: space[2] },
  upload: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1], width: '100%' },
  zone: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, gap: space[2], paddingHorizontal: space[4], paddingVertical: space[7] },
  zoneCompact: { flexDirection: 'row', paddingHorizontal: space[3], paddingVertical: space[2.5] },
  zoneText: { flex: 1, minWidth: 0 },
  zoneTextCentered: { alignItems: 'center', flex: 0 },
  // Button hugs the start of its row by default; the empty zone centres it, as on the web.
  centered: { alignSelf: 'center' },
  row: { overflow: 'hidden', paddingTop: space[1] },
  group: { maxWidth: 480, width: '100%' },
  groupRow: { gap: space[2], padding: space[1] },
  groupCard: { width: CARD_WIDTH },
  groupFade: { alignItems: 'flex-end', bottom: 0, justifyContent: 'center', paddingRight: space[1], position: 'absolute', right: 0, top: 0, width: GROUP_FADE },
  footer: { flexDirection: 'row', gap: space[2], justifyContent: 'flex-end', paddingBottom: space[1], paddingHorizontal: space[2], paddingTop: space[2] },
})
