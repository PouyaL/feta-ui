import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button, SELF } from './button'
import { panelEnter, type RenderIcon, type, useFlash, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const DOTS = '••••••••••••'
const mask = (value: string): string => `${value.slice(0, value.indexOf('_', 3) + 1)}${DOTS}${value.slice(-4)}`

export type ApiKeyProps = {
  name: string
  /** The full key. Stays off screen until revealed or copied. */
  value: string
  environment?: 'live' | 'test'
  /** Line under the key. */
  meta: string
  revoked?: boolean
  renderIcon: RenderIcon
  /** React Native ships no clipboard, so the app writes the text. */
  onCopy?: (value: string) => void | Promise<void>
  onRoll?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One key on a 4% well. Hidden until revealed; Copied confirms for 2 s; Revoked removes the actions. */
export function ApiKey({ name, value, environment = 'live', meta, revoked = false, renderIcon, onCopy, onRoll, animated = true, style }: ApiKeyProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [shown, setShown] = useState(false)
  const [copied, flash] = useFlash()
  const open = (shown || copied) && !revoked
  const fade = still ? {} : { entering: FadeIn.duration(150), exiting: FadeOut.duration(150) }
  async function copy(): Promise<void> {
    await onCopy?.(value)
    flash()
  }
  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={`${name} API key`} style={[styles.card, style]}>
      <View style={styles.head}>
        {renderIcon('lock', 16)}
        <Text style={[styles.name, revoked && styles.nameRevoked]} numberOfLines={1}>{name}</Text>
        {revoked ? <Badge size="sm" tone="danger" mark>Revoked</Badge> : <Badge size="sm" tone={environment === 'live' ? 'success' : 'warning'} mark>{environment === 'live' ? 'Live' : 'Test'}</Badge>}
      </View>
      <View style={styles.well}>
        <Text style={[styles.key, revoked && styles.keyRevoked]} numberOfLines={1} ellipsizeMode="middle" selectable={open}>{open ? value : mask(value)}</Text>
        {revoked ? null : (
          <>
            <IconButton style={SELF.center} variant="ghost" size="sm" label={shown ? 'Hide key' : 'Reveal key'} {...pressedState(shown)} icon={renderIcon(shown ? 'eye-off' : 'eye', 16)} onPress={() => setShown(!shown)} animated={animated} />
            {copied
              ? <Animated.View key="copied" {...fade} accessibilityLiveRegion="polite" style={styles.copied}>{renderIcon('check', 14)}<Text style={styles.small}>Copied</Text></Animated.View>
              : <IconButton style={SELF.center} variant="ghost" size="sm" label="Copy key" icon={renderIcon('copy', 16)} onPress={() => void copy()} animated={animated} />}
          </>
        )}
      </View>
      <View style={styles.foot}>
        <Text style={styles.small}>{meta}</Text>
        {revoked ? null : <Button style={[SELF.center, styles.roll]} variant="ghost" size="sm" onPress={onRoll} animated={animated}>Roll key</Button>}
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, gap: space[2], paddingHorizontal: space[4], paddingVertical: space[3] },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  name: { ...type(16, c.textPrimary, '500'), flex: 1 },
  nameRevoked: { color: c.textSecondary },
  well: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.field, flexDirection: 'row', gap: space[1], minHeight: 40, paddingLeft: space[3], paddingRight: space[1] },
  key: { ...type(12, c.textPrimary, '400', true), flex: 1 },
  keyRevoked: { color: c.textQuaternary },
  copied: { alignItems: 'center', flexDirection: 'row', gap: space[1], paddingHorizontal: space[2] },
  foot: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 28 },
  // The foot is 28 tall like the web; the 36 point button overhangs it instead of padding the card.
  roll: { marginVertical: -space[1], marginRight: -space[2] },
  small: type(12, c.textSecondary),
})
