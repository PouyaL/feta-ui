import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { openLink, radius, space, useColors, type Colors } from '../kit'
import { Badge } from './badge'
import { withInk } from './button'
import { type RenderIcon, type, useThemed } from './card'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type Tone = 'info' | 'success' | 'warning' | 'accent' | 'danger'
export const METHOD_TONE: Record<HttpMethod, Tone> = { GET: 'info', POST: 'success', PUT: 'warning', PATCH: 'accent', DELETE: 'danger' }

export type EndpointProps = {
  method: HttpMethod
  path: string
  summary: string
  /** Opens this link on press. */
  href?: string
  onPress?: () => void
  renderIcon?: RenderIcon
  style?: StyleProp<ViewStyle>
}

/** A method Badge in a fixed column, a mono path and a one line summary. */
export function Endpoint({ method, path, summary, href, onPress, renderIcon, style }: EndpointProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={`${method} ${path}. ${summary}`}
      onPress={() => { if (href) openLink(href); else onPress?.() }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      <View style={styles.method}><Badge size="sm" tone={METHOD_TONE[method]} mark>{method}</Badge></View>
      <View style={styles.text}>
        <Text style={styles.path} numberOfLines={1}>{path}</Text>
        <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
      </View>
      {renderIcon ? withInk(renderIcon('chevron-right', 16), colors.textTertiary) : null}
    </Pressable>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  // 64 tall with a hairline ring, the method column 80 on a phone, like the web's Mobile layout.
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3], width: '100%', maxWidth: 358, minHeight: 64, paddingHorizontal: space[4], paddingVertical: space[2.5], borderRadius: radius.control, borderWidth: 1, borderColor: c.ink8 },
  pressed: { backgroundColor: c.ink4 },
  method: { width: 80 },
  text: { flex: 1, minWidth: 0 },
  path: { ...type(12, c.textPrimary, '400', true), lineHeight: 18 },
  summary: { ...type(12, c.textSecondary), lineHeight: 16 },
})
