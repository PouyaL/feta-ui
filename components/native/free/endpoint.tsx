import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { openLink, space, type Colors } from '../kit'
import { Badge } from './badge'
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
      {renderIcon?.('chevron-right', 16)}
    </Pressable>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3], minHeight: 56, paddingHorizontal: space[3], paddingVertical: space[2] },
  pressed: { backgroundColor: c.ink4 },
  method: { width: 72 },
  text: { flex: 1, gap: space[0.5] },
  path: type(14, c.textPrimary, '500', true),
  summary: type(12, c.textSecondary),
})
