import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button, SELF } from './button'
import { Panel, PanelBody, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { SearchField } from './search'
import { Tabs } from './tabs'

export type Integration = { id: string; name: string; category: string; description: string; icon: ReactNode; connected?: boolean }

export type IntegrationsProps = {
  items: Integration[]
  /** Resolve when connected. */
  onConnect?: (id: string) => Promise<void> | void
  onConfigure?: (id: string) => void
  /** Starts with this row in progress. */
  connecting?: string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Search, category Tabs and rows with Connect, Configure or a Connected Badge. */
export function Integrations({ items, onConnect, onConfigure, connecting, renderIcon, animated = true, style }: IntegrationsProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [connected, setConnected] = useState(items.filter((item) => item.connected).map((item) => item.id))
  const [busy, setBusy] = useState<string[]>(connecting ? [connecting] : [])
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items])
  const needle = query.trim().toLowerCase()
  const shown = items.filter((item) => (tab === 'all' || (tab === 'connected' ? connected.includes(item.id) : item.category === tab)) && (!needle || `${item.name} ${item.category}`.toLowerCase().includes(needle)))
  async function connect(id: string): Promise<void> {
    setBusy((list) => [...list, id])
    await onConnect?.(id)
    setBusy((list) => list.filter((item) => item !== id))
    setConnected((list) => [...list, id])
  }
  return (
    <Panel title="Integrations" subtitle="Connect the tools your team already works in." animated={animated} style={style}>
      <View style={styles.controls}>
        <SearchField value={query} onValueChange={setQuery} placeholder="Search by name or category" accessibilityLabel="Search integrations" animated={animated} />
        <Tabs label="Category" value={tab} onValueChange={setTab} animated={animated} items={[{ value: 'all', label: 'All', count: items.length }, { value: 'connected', label: 'Connected', count: connected.length }, ...categories.map((category) => ({ value: category, label: category, count: items.filter((item) => item.category === category).length }))]} />
      </View>
      <PanelBody>
        {shown.map((item, i) => {
          const isBusy = busy.includes(item.id)
          return (
            <Animated.View key={item.id} {...(still ? {} : { entering: rowEnter(i) })} style={styles.row}>
              <View style={styles.tile}>{item.icon}</View>
              <View style={styles.text}><Text style={styles.name} numberOfLines={1}>{item.name} <Text style={styles.small}>{item.category}</Text></Text><Text style={styles.small}>{item.description}</Text></View>
              {connected.includes(item.id)
                ? <Pressable style={styles.status} accessibilityRole="button" accessibilityLabel={`Configure ${item.name}`} accessibilityHint="Connected" onPress={() => onConfigure?.(item.id)}><Badge size="sm" tone="success" mark>Connected</Badge></Pressable>
                : <Button style={SELF.center} variant={isBusy ? 'primary' : 'secondary'} shape="pill" size="sm" leadingIcon={renderIcon('plus', 14)} status={isBusy ? 'loading' : 'idle'} loadingLabel="Connecting" onPress={() => void connect(item.id)} animated={animated}>Connect</Button>}
            </Animated.View>
          )
        })}
        {shown.length === 0 ? <Text style={styles.empty}>No integrations match.</Text> : null}
      </PanelBody>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  controls: { gap: space[2], paddingBottom: space[3], paddingHorizontal: space[4] },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3], minHeight: 60, paddingVertical: space[2] },
  tile: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, height: 36, justifyContent: 'center', width: 36 },
  text: { flex: 1, gap: space[0.5] },
  name: type(16, c.textPrimary, '500'),
  small: type(12, c.textSecondary),
  status: { alignSelf: 'center', justifyContent: 'center', minHeight: 44 },
  empty: { ...type(14, c.textSecondary), textAlign: 'center' },
})
