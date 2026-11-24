import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'

const REVEAL_MS = 320
const REVEAL_REDUCED_MS = 120
const ERROR_FADE_MS = 200
const SHIMMER_MS = 1400
const REVEAL_EASE = Easing.bezier(0.22, 1, 0.36, 1)
const errorEnter = FadeIn.duration(ERROR_FADE_MS).easing(Easing.bezierFn(0.22, 1, 0.36, 1))

export type AspectRatioValue = '1:1' | '4:3' | '3:2' | '16:9' | '21:9' | '9:16'

export type AspectRatioProps = {
  /** Picked from the content, not the container. Default `16:9`. */
  ratio?: AspectRatioValue
  /** An image to load. Shows Loading until it decodes, then Error if it fails. */
  src?: string
  /** Required with `src`. Use an empty string for a decorative image. */
  alt?: string
  /** Forces a state. Without it, the state follows `src`, `children` and the load. */
  content?: 'image' | 'video' | 'loading' | 'empty' | 'error'
  /** Your own media, such as a video view or a drawn scene. */
  children?: ReactNode
  /** Visible text under the frame. Alt text is for screen readers. */
  caption?: ReactNode
  /** Video: the time on the chip, like `2:14`. */
  duration?: string
  onPlay?: () => void
  /** Empty: Upload was pressed. Open your image picker here. */
  onUpload?: () => void
  /** Empty: the Upload button shows Button Loading while this is true. */
  uploading?: boolean
  emptyTitle?: string
  emptyHint?: string
  errorTitle?: string
  errorHint?: string
  /** Error: Retry returns to Loading. */
  onRetry?: () => void
  renderIcon: RenderIcon
  /** `false` keeps the shimmer and the reveal still. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Shimmer({ moving, renderIcon }: { moving: boolean; renderIcon: RenderIcon }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const [wide, setWide] = useState(0)
  const sweep = useSharedValue(0)
  useEffect(() => {
    if (!moving) return undefined
    sweep.value = withRepeat(withTiming(1, { duration: SHIMMER_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(sweep)
  }, [moving, sweep])
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: wide * (sweep.value * 2 - 0.5) }] }))
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onLayout={(e) => setWide(e.nativeEvent.layout.width)} style={styles.loading}>
      {moving ? (
        <Animated.View style={[styles.fill, slide]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0.2">
                <Stop offset="0.3" stopColor={colors.ink8} stopOpacity={0} />
                <Stop offset="0.5" stopColor={colors.ink8} />
                <Stop offset="0.7" stopColor={colors.ink8} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#shimmer)" />
          </Svg>
        </Animated.View>
      ) : null}
      <View style={styles.loadingIcon}>{renderIcon('image', 20)}</View>
    </View>
  )
}

/** Holds media at a fixed ratio, so layouts never jump while it loads. */
export function AspectRatio({ ratio = '16:9', src, alt = '', content, children, caption, duration, onPlay, onUpload, uploading = false, emptyTitle = 'Add an image', emptyHint, errorTitle = 'Couldn’t load image', errorHint = 'Check the link and try again', onRetry, renderIcon, animated = true, style }: AspectRatioProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [load, setLoad] = useState<{ src: string; state: 'ready' | 'failed' } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const known = load?.src === src ? load?.state ?? null : null
  const state = content ?? (src ? (known === 'failed' ? 'error' : known === 'ready' ? 'image' : 'loading') : children ? 'image' : 'empty')
  const [width = 16, height = 9] = ratio.split(':').map(Number)
  const showImage = Boolean(src) && (state === 'image' || state === 'loading')
  const frame = useMemo<ViewStyle>(() => ({ aspectRatio: width / height }), [width, height])

  const reveal = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (state !== 'image') {
      reveal.value = 0
      return
    }
    reveal.value = withTiming(1, { duration: animated ? (still ? REVEAL_REDUCED_MS : REVEAL_MS) : 0, easing: REVEAL_EASE })
  }, [state, still, animated, reveal])
  const moves = !still
  const imageMotion = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ scale: moves ? 1.02 - reveal.value * 0.02 : 1 }] }))

  function retry(): void {
    setLoad(null)
    setAttempt((value) => value + 1)
    onRetry?.()
  }

  return (
    <View style={[styles.root, style]}>
      <View aria-busy={state === 'loading'} style={[styles.frame, frame, state === 'empty' ? styles.frameEmpty : null]}>
        {showImage && src ? (
          <Animated.View style={[styles.fill, imageMotion]}>
            <Image
              key={`${src}-${attempt}`}
              source={{ uri: src }}
              accessible={alt !== ''}
              accessibilityLabel={alt}
              resizeMode="cover"
              style={styles.media}
              onLoad={() => setLoad({ src, state: 'ready' })}
              onError={() => setLoad({ src, state: 'failed' })}
            />
          </Animated.View>
        ) : null}
        {!src && (state === 'image' || state === 'video') ? <View style={styles.fill}>{children}</View> : null}
        {state === 'loading' ? <Shimmer moving={!still} renderIcon={renderIcon} /> : null}

        {state === 'video' ? (
          <>
            <View pointerEvents="none" style={styles.fill}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="scrim" x1="0" y1="1" x2="0" y2="0.3">
                    <Stop offset="0" stopColor={colors.inverse} stopOpacity={0.5} />
                    <Stop offset="1" stopColor={colors.inverse} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#scrim)" />
              </Svg>
            </View>
            <View style={styles.play}>
              <Button
                variant="outline"
                shape="pill"
                size="lg"
                animated={animated}
                style={styles.center}
                accessibilityLabel={duration ? `Play video, ${duration}` : 'Play video'}
                leadingIcon={<Svg width={14} height={16} viewBox="0 0 14 16"><Polygon points="1,0 14,8 1,16" fill={colors.textPrimary} /></Svg>}
                {...(onPlay ? { onPress: onPlay } : {})}
              />
            </View>
            {duration ? <View style={styles.chip}><Text style={styles.chipText}>{duration}</Text></View> : null}
          </>
        ) : null}

        {state === 'empty' ? (
          <View style={[styles.message, styles.dashed]}>
            {renderIcon('image', 24)}
            <Text style={styles.title}>{emptyTitle}</Text>
            <Text style={styles.hint}>{emptyHint ?? `PNG or JPG · ${ratio}`}</Text>
            <Button variant="secondary" size="sm" animated={animated} style={styles.center} status={uploading ? 'loading' : 'idle'} leadingIcon={renderIcon('upload', 16)} {...(onUpload ? { onPress: onUpload } : {})}>Upload</Button>
          </View>
        ) : null}

        {state === 'error' ? (
          <Animated.View {...(still ? {} : { entering: errorEnter })} accessibilityRole="alert" style={styles.message}>
            {renderIcon('alert-circle', 24)}
            <Text style={styles.title}>{errorTitle}</Text>
            <Text style={styles.hint}>{errorHint}</Text>
            <Button variant="secondary" size="sm" animated={animated} style={styles.center} leadingIcon={renderIcon('refresh-cw', 16)} onPress={retry}>Retry</Button>
          </Animated.View>
        ) : null}
      </View>
      {typeof caption === 'string' ? <Text style={styles.caption}>{caption}</Text> : caption}
    </View>
  )
}

/** The drawn stand-in from the Figma frames. Replace it with real media. */
export function AspectRatioScene({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors()
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" style={style}>
      <Rect width={320} height={180} fill={colors.muted} />
      <Circle cx={226} cy={74} r={26} fill={colors.textQuaternary} />
      <Path d="M0 118C60 88 108 96 168 122S280 142 320 112V180H0Z" fill={colors.textTertiary} />
      <Path d="M0 152C54 124 132 128 188 146S288 166 320 148V180H0Z" fill={colors.textSecondary} />
    </Svg>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  root: { width: '100%', gap: space[2] },
  frame: { width: '100%', overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.ink5 },
  frameEmpty: { borderWidth: 0, backgroundColor: c.ink4 },
  fill: StyleSheet.absoluteFill,
  media: { width: '100%', height: '100%' },
  loading: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  loadingIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  play: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  // Button hugs the start of its row by default; these sit centred like the web frame.
  center: { alignSelf: 'center' },
  chip: { position: 'absolute', right: space[2], bottom: space[2], paddingVertical: space[0.5], paddingHorizontal: space[1.5], borderRadius: radius.md, backgroundColor: c.inverse },
  chipText: type(12, c.textInverse, '400', true),
  message: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space[2], padding: space[3] },
  dashed: { borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink10, borderRadius: radius.card },
  title: { ...type(14, c.textPrimary, '500'), textAlign: 'center' },
  hint: { ...type(12, c.textSecondary), textAlign: 'center' },
  caption: { ...type(14, c.textTertiary), lineHeight: 18 },
})
