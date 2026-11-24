import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { AVATAR_PEOPLE, Avatar, type AvatarPerson } from './avatar'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'

const MEGABYTE = 1024 * 1024
const RING_SIZE = 64
const RING_RADIUS = 30
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const RING_MS = 200
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** What your image picker returns. */
export type PickedPhoto = { uri: string; name: string; bytes: number }

export type AvatarUploadValue = { state: 'empty' } | { state: 'uploading'; name: string; progress: number; src?: string; person?: AvatarPerson } | { state: 'uploaded'; name: string; size: string; src?: string; person?: AvatarPerson } | { state: 'error'; reason: string }

export type AvatarUploadProps = {
  /** Largest file, in MB. Default 5. */
  maxMb?: number
  /** Opens your image picker. Resolve `null` when the person cancels. */
  pick: () => Promise<PickedPhoto | null>
  /** Does the upload and reports 0 to 100. */
  upload: (photo: PickedPhoto, report: (percent: number) => void, signal: AbortSignal) => Promise<void>
  onChange?: (value: { src?: string; person?: AvatarPerson } | null) => void
  samples?: readonly AvatarPerson[]
  title?: string
  hint?: string
  /** Forces a state, for specimens and tests. */
  initial?: AvatarUploadValue
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const sizeLabel = (bytes: number): string => (bytes >= MEGABYTE ? `${Math.round(bytes / MEGABYTE)} MB` : `${Math.round(bytes / 1024)} KB`)

function ProgressRing({ percent, still }: { percent: number; still: boolean }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const shown = useSharedValue(percent)
  useEffect(() => {
    shown.value = still ? percent : withTiming(percent, { duration: RING_MS, easing: Easing.linear })
  }, [percent, still, shown])
  const arc = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * (1 - shown.value / 100) }))
  return (
    <View style={styles.arc}>
      <Svg width={RING_SIZE} height={RING_SIZE} fill="none">
        <AnimatedCircle animatedProps={arc} cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={colors.textInverse} strokeWidth={3} strokeDasharray={[RING_LENGTH, RING_LENGTH]} />
      </Svg>
    </View>
  )
}

/** A profile photo with progress, replace and error, or a sample face. */
export function AvatarUpload({ maxMb = 5, pick, upload, onChange, samples = AVATAR_PEOPLE, title = 'Profile photo', hint, initial, renderIcon, animated = true, style }: AvatarUploadProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const abort = useRef<AbortController | null>(null)
  const [value, setValue] = useState<AvatarUploadValue>(initial ?? { state: 'empty' })
  useEffect(() => () => abort.current?.abort(), [])

  async function browse(): Promise<void> {
    const photo = await pick()
    if (!photo) return
    if (photo.bytes > maxMb * MEGABYTE) {
      setValue({ state: 'error', reason: `That file is ${sizeLabel(photo.bytes)}. Pick one under ${maxMb} MB.` })
      return
    }
    const controller = new AbortController()
    abort.current = controller
    setValue({ state: 'uploading', name: photo.name, progress: 0, src: photo.uri })
    const report = (percent: number): void => setValue((now) => (now.state === 'uploading' ? { ...now, progress: Math.round(percent) } : now))
    try {
      await upload(photo, report, controller.signal)
      if (controller.signal.aborted) return
      setValue({ state: 'uploaded', name: photo.name, size: sizeLabel(photo.bytes), src: photo.uri })
      onChange?.({ src: photo.uri })
    } catch {
      if (!controller.signal.aborted) setValue({ state: 'error', reason: 'The upload failed. Try again.' })
    }
  }

  function clear(): void {
    abort.current?.abort()
    setValue({ state: 'empty' })
    onChange?.(null)
  }

  const start = (): void => { void browse() }
  const uploaded = value.state === 'uploaded' ? value : null
  const failed = value.state === 'error'
  const meta = value.state === 'uploading' ? `Uploading ${value.name} · ${value.progress}%` : value.state === 'uploaded' ? `${value.name} · ${value.size}` : value.state === 'error' ? value.reason : hint ?? `PNG, JPG or WebP, up to ${maxMb} MB`

  return (
    <View style={[styles.tray, style]}>
      <View style={[styles.card, failed ? styles.cardError : null]}>
        <View style={styles.main}>
          <Pressable accessibilityRole="button" accessibilityLabel={uploaded ? 'Replace photo' : 'Upload photo'} onPress={start}>
            {uploaded ? (
              <Avatar size="xl" alt="" animated={animated} badge="edit" badgeLabel="Edit" renderIcon={renderIcon} {...(uploaded.src ? { src: uploaded.src } : {})} {...(uploaded.person ? { person: uploaded.person } : {})} />
            ) : value.state === 'uploading' ? (
              <View>
                <Avatar size="xl" alt="" animated={animated} loading={!value.src && !value.person} {...(value.src ? { src: value.src } : {})} {...(value.person ? { person: value.person } : {})} />
                <View style={styles.veil}><Text style={styles.veilText}>{value.progress}%</Text></View>
                <ProgressRing percent={value.progress} still={still} />
              </View>
            ) : (
              <View style={[styles.dashed, failed ? styles.dashedError : null]}>
                {failed ? <View style={styles.alert}>{renderIcon('alert-circle', 16)}</View> : renderIcon('camera', 20)}
              </View>
            )}
          </Pressable>
          <View style={styles.text}>
            <Text style={styles.title}>{title}</Text>
            <Text accessibilityLiveRegion="polite" style={[styles.meta, failed ? styles.metaError : null]}>{meta}</Text>
            <View style={styles.actions}>
              {value.state === 'empty' ? <Button variant="secondary" size="sm" animated={animated} leadingIcon={renderIcon('upload', 16)} onPress={start}>Upload photo</Button> : null}
              {value.state === 'uploading' ? <Button variant="ghost" size="sm" animated={animated} onPress={clear}>Cancel</Button> : null}
              {uploaded ? <><Button variant="secondary" size="sm" animated={animated} leadingIcon={renderIcon('upload', 16)} onPress={start}>Replace photo</Button><Button variant="ghost" size="sm" animated={animated} onPress={clear}>Remove</Button></> : null}
              {failed ? <><Button variant="secondary" size="sm" animated={animated} leadingIcon={renderIcon('upload', 16)} onPress={start}>Try another photo</Button><Button variant="ghost" size="sm" animated={animated} onPress={clear}>Dismiss</Button></> : null}
            </View>
          </View>
        </View>
      </View>
      <View style={styles.samples}>
        <Text style={styles.samplesLabel}>Or pick a sample</Text>
        <View style={styles.sampleRow}>
          {samples.map((person) => (
            <Pressable key={person} accessibilityRole="button" accessibilityLabel={`Use the ${person} sample`} aria-selected={uploaded?.person === person} hitSlop={8} onPress={() => { setValue({ state: 'uploaded', name: `${person}.png`, size: 'sample', person }); onChange?.({ person }) }} style={styles.sample}>
              <Avatar person={person} size="sm" animated={animated} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  card: { padding: space[5], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  cardError: { borderColor: c.danger },
  main: { flexDirection: 'row', alignItems: 'flex-start', gap: space[4] },
  dashed: { alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink10, borderRadius: radius.full, backgroundColor: c.ink4 },
  dashedError: { borderStyle: 'solid', borderColor: c.danger, backgroundColor: 'transparent' },
  alert: { alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: radius.full, backgroundColor: c.danger },
  veil: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: c.ink10 },
  veilText: type(12, c.textPrimary, '500', true),
  arc: { ...StyleSheet.absoluteFill, transform: [{ rotate: '-90deg' }] },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  title: type(14, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  metaError: { color: c.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
  samples: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingTop: space[2], paddingHorizontal: space[3], paddingBottom: space[1] },
  samplesLabel: type(12, c.textSecondary),
  sampleRow: { flexDirection: 'row', gap: space[1] },
  sample: { padding: space[0.5], borderRadius: radius.full },
})
