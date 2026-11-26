import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'

/** Rows slide to their sorted place. Past `SORT_ROW_LIMIT` rows they jump, so big tables stay instant. */
export const SORT_MS = 240
export const SORT_ROW_LIMIT = 200
const CHEVRON_MS = 160
const SMALL_COLUMN = 44
const font14 = -0.56
const slide = LinearTransition.duration(SORT_MS).easing(Easing.bezierFn(0.23, 1, 0.32, 1))

export type TableDensity = 'compact' | 'comfortable'
export type TableStyle = 'grid' | 'plain'
export type TableCellType = 'text' | 'title' | 'muted' | 'number' | 'amount' | 'mono' | 'avatar' | 'badge' | 'checkbox' | 'action' | 'tree'
export type SortDirection = 'asc' | 'desc'

type TableContextValue = { density: TableDensity; styleKind: TableStyle; striped: boolean; still: boolean; renderIcon: RenderIcon | undefined; sliding: boolean }
const TableContext = createContext<TableContextValue>({ density: 'comfortable', styleKind: 'plain', striped: false, still: true, renderIcon: undefined, sliding: false })
const RowContext = createContext({ index: 0, striped: false })

const alignsEnd = (cell: TableCellType): boolean => cell === 'number' || cell === 'amount' || cell === 'mono'
const isSmall = (cell: TableCellType): boolean => cell === 'checkbox' || cell === 'action'

export type TableProps = {
  /** `compact` is 13 on 44 rows for grids. `comfortable` is 14 on 52 rows for app tables. Default `comfortable`. */
  density?: TableDensity
  /** `grid` has 8% dividers and rules on a 4% header. `plain` has only 5% row rules. Default `plain`. */
  styleKind?: TableStyle
  /** Washes every other row. */
  striped?: boolean
  /** Shown to everyone on the tray when set; read as the table's name. */
  caption?: ReactNode
  /** Turns off the sideways scroll, for tables that fit the screen. */
  noScroll?: boolean
  /** The width rows stretch to inside the sideways scroll. Default 640. */
  minWidth?: number
  /** Draws sort arrows and tree chevrons. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** A table built from rows of cells, scrolling sideways inside its own frame when the columns need more room. */
export function Table({ density = 'comfortable', styleKind = 'plain', striped = false, caption, noScroll = false, minWidth = 640, renderIcon, animated = true, style, children }: TableProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const value = useMemo(() => ({ density, styleKind, striped, still, renderIcon, sliding: !still }), [density, styleKind, striped, still, renderIcon])
  // A definite width, so every row splits its flex columns the same way. With only a minimum, rows sized their columns to their own text.
  const [viewport, setViewport] = useState(0)
  const wide = useMemo(() => ({ width: Math.max(minWidth, viewport) }), [minWidth, viewport])
  return (
    <TableContext.Provider value={value}>
      {typeof caption === 'string' ? <Text style={styles.caption}>{caption}</Text> : caption}
      {noScroll ? <View style={style}>{children}</View> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={wide} onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
          <View style={styles.fill}>{children}</View>
        </ScrollView>
      )}
    </TableContext.Provider>
  )
}

export type TableCardProps = { title?: ReactNode; meta?: ReactNode; caption?: ReactNode; style?: StyleProp<ViewStyle>; children: ReactNode }

/** The Soft shell: a 4% tray holding the table in a surface card. `caption` sits on the tray. */
export function TableCard({ title, meta, caption, style, children }: TableCardProps) {
  const styles = useThemed(makeStyles)
  return (
    <View style={[styles.tray, style]}>
      {title || meta ? (
        <View style={styles.cardHead}>
          {typeof title === 'string' ? <Text style={styles.cardTitle}>{title}</Text> : title}
          {typeof meta === 'string' ? <Text style={styles.cardMeta}>{meta}</Text> : meta}
        </View>
      ) : null}
      {/* The table sits in a 14 radius frame inside the body card; its ring draws over the cells. */}
      <View style={styles.card}>
        <View style={styles.frame}>{children}</View>
        <View pointerEvents="none" style={styles.frameRing} />
      </View>
      {typeof caption === 'string' ? <Text style={styles.cardCaption}>{caption}</Text> : caption}
    </View>
  )
}

export function TableHeader({ children }: { children: ReactNode }) {
  const styles = useThemed(makeStyles)
  const { styleKind } = useContext(TableContext)
  return <View style={styleKind === 'grid' ? styles.headerGrid : null}>{children}</View>
}

export function TableBody({ children }: { children: ReactNode }) {
  const { striped } = useContext(TableContext)
  return <View>{Children.toArray(children).map((row, index) => <RowContext.Provider key={index} value={{ index, striped }}>{row}</RowContext.Provider>)}</View>
}

export function TableFooter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemed(makeStyles)
  const { styleKind } = useContext(TableContext)
  return <View style={[styles.footer, style]}>{lastWithoutDivider(children, styleKind)}</View>
}

/** Grid draws a divider after every cell but the last, as the web's :last-child rule does. */
function lastWithoutDivider(children: ReactNode, styleKind: TableStyle): ReactNode {
  if (styleKind !== 'grid') return children
  const list = Children.toArray(children)
  return list.map((child, i) => (i === list.length - 1 && isValidElement<{ noDivider?: boolean }>(child) ? cloneElement(child, { noDivider: true }) : child))
}

export type TableRowProps = {
  selected?: boolean
  /** Makes the whole row a button. */
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** One row. Give it a stable `key` and it slides when the order changes. */
export function TableRow({ selected = false, onPress, accessibilityLabel, style, children }: TableRowProps) {
  const styles = useThemed(makeStyles)
  const { sliding, styleKind } = useContext(TableContext)
  const { index, striped } = useContext(RowContext)
  const cells = lastWithoutDivider(children, styleKind)
  const look = [styles.row, striped && index % 2 === 1 ? styles.rowStriped : null, selected ? styles.rowSelected : null, style]
  return (
    <Animated.View {...(sliding ? { layout: slide } : {})}>
      {onPress ? (
        <Pressable accessibilityRole="button" {...pressedState(selected)} {...(accessibilityLabel ? { accessibilityLabel } : {})} onPress={onPress} style={look}>{cells}</Pressable>
      ) : <View style={look}>{cells}</View>}
    </Animated.View>
  )
}

const columnStyle = (cell: TableCellType, width: number | undefined): ViewStyle => (width !== undefined ? { width } : isSmall(cell) ? { width: SMALL_COLUMN } : { flex: 1, minWidth: 0 })

export type TableHeadProps = {
  /** `number`, `amount` and `mono` align right, like their cells. */
  type?: TableCellType
  /** Show a sort button. `false` when sortable but not the sorted column. */
  sort?: SortDirection | false
  onSort?: () => void
  /** Points. Give the same width to this column's cells. */
  width?: number
  /** Set `true` to hide the 8% divider in `grid`. */
  noDivider?: boolean
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

/** A column header. A sortable one is a real button, and says which way it sorts. */
export function TableHead({ type: cell = 'text', sort, onSort, width, noDivider = false, style, children }: TableHeadProps) {
  const styles = useThemed(makeStyles)
  const { density, styleKind, renderIcon } = useContext(TableContext)
  const box = useMemo(() => columnStyle(cell, width), [cell, width])
  const end = alignsEnd(cell)
  const look = [styles.head, density === 'compact' ? styles.headCompact : null, styleKind === 'grid' ? styles.headGrid : null, end ? styles.alignEnd : null, styleKind === 'grid' && !noDivider ? styles.divider : null, box, style]
  const label = typeof children === 'string' ? <Text style={[styles.headText, density === 'compact' ? styles.headTextCompact : null]} numberOfLines={1}>{children}</Text> : children
  if (!onSort) return <View style={look}>{label}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${typeof children === 'string' ? children : 'Column'}, ${sort === 'asc' ? 'sorted ascending' : sort === 'desc' ? 'sorted descending' : 'not sorted'}`}
      {...pressedState(Boolean(sort))}
      onPress={onSort}
      style={look}
    >
      {label}
      {sort ? renderIcon?.(sort === 'asc' ? 'arrow-up' : 'arrow-down', 14) : null}
    </Pressable>
  )
}

const TEXT_STYLE: Partial<Record<TableCellType, 'cellTitle' | 'cellMuted' | 'cellNumber' | 'cellMono'>> = { title: 'cellTitle', muted: 'cellMuted', number: 'cellNumber', amount: 'cellNumber', mono: 'cellMono' }

export type TableCellProps = {
  type?: TableCellType
  /** Second line, for `title` and `tree`. */
  sub?: ReactNode
  /** The picture, for `avatar`. */
  avatar?: ReactNode
  /** Points. Match the column's head. */
  width?: number
  /** Grid: ink ring. Plain: 4% wash. */
  selected?: boolean
  /** Lifts onto the surface with a 2 point ring. Put the input in `children`. */
  editing?: boolean
  /** Lifts onto the surface with an 8% ring. */
  elevated?: boolean
  /** Part of the sorted column: 4% wash. */
  sorted?: boolean
  /** Hide the divider in `grid`. */
  noDivider?: boolean
  /** Hide the row rule. */
  noRule?: boolean
  /** Tree depth, 0 to 2. Each level indents. */
  level?: number
  /** Tree chevron state. Leave it out on leaf rows. */
  expanded?: boolean
  onToggle?: () => void
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

function TreeChevron({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const styles = useThemed(makeStyles)
  const { still, renderIcon } = useContext(TableContext)
  const turn = useSharedValue(open ? 90 : 0)
  useEffect(() => {
    turn.value = still ? (open ? 90 : 0) : withTiming(open ? 90 : 0, { duration: CHEVRON_MS })
  }, [open, still, turn])
  const motion = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Collapse' : 'Expand'} aria-expanded={open} hitSlop={12} onPress={onToggle} style={styles.tree}>
      <Animated.View style={motion}>{renderIcon?.('chevron-right', 14)}</Animated.View>
    </Pressable>
  )
}

/** The building block for every table: eleven types, set by `type`. */
export function TableCell({ type: cell = 'text', sub, avatar, width, selected = false, editing = false, elevated = false, sorted = false, noDivider = false, noRule = false, level = 0, expanded, onToggle, style, children }: TableCellProps) {
  const styles = useThemed(makeStyles)
  const { density, styleKind } = useContext(TableContext)
  const box = useMemo(() => columnStyle(cell, width), [cell, width])
  const tone = TEXT_STYLE[cell]
  const textStyle: StyleProp<TextStyle> = [styles.cellText, density === 'compact' ? styles.cellCompact : null, tone ? styles[tone] : null]
  const body = typeof children === 'string' || typeof children === 'number' ? <Text style={textStyle} numberOfLines={1}>{children}</Text> : children
  const subText = typeof sub === 'string' ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : sub
  return (
    <View
      style={[
        styles.cell, density === 'compact' ? styles.cellRowCompact : null, alignsEnd(cell) ? styles.alignEnd : null,
        noRule ? null : styleKind === 'grid' ? styles.ruleGrid : styles.rule, styleKind === 'grid' && !noDivider ? styles.divider : null,
        sorted || (selected && styleKind === 'plain') ? styles.wash : null, selected && styleKind === 'grid' ? styles.ring : null,
        editing ? styles.editing : null, elevated ? styles.elevated : null, box, style,
      ]}
    >
      {cell === 'tree' ? (
        // The web tree cell: a 20 px guide per level with a hairline down its middle, a 16 px toggle, then the name
        // with its mono sub on the same line.
        <View style={styles.treeRow}>
          {Array.from({ length: level }, (_, i) => <View key={i} aria-hidden style={styles.guide}><View style={styles.guideLine} /></View>)}
          {onToggle ? <TreeChevron open={expanded ?? false} onToggle={onToggle} /> : <View style={styles.tree} />}
          <View style={styles.treeName}>
            {body}
            {typeof sub === 'string' ? <Text style={styles.treeSub} numberOfLines={1}>{sub}</Text> : sub}
          </View>
        </View>
      ) : cell === 'avatar' ? (
        <View style={styles.treeRow}>{avatar}<View style={styles.stack}>{body}{subText}</View></View>
      ) : sub ? <View style={styles.stack}>{body}{subText}</View> : body}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  fill: { flex: 1 },
  caption: { ...type(12, c.textSecondary), paddingVertical: space[2], paddingHorizontal: space[3] },
  tray: { width: '100%', gap: space[1], padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingVertical: space[2], paddingHorizontal: space[3] },
  cardTitle: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
  cardMeta: { ...type(10, c.textSecondary, '400', true), letterSpacing: 0.4, lineHeight: 12 },
  card: { padding: space[1], borderRadius: radius.card, backgroundColor: c.surface },
  frame: { overflow: 'hidden', borderRadius: radius.control },
  frameRing: { position: 'absolute', top: space[1], right: space[1], bottom: space[1], left: space[1], borderRadius: radius.control, borderWidth: 1, borderColor: c.ink8 },
  cardCaption: { ...type(12, c.textTertiary), lineHeight: 16, paddingVertical: space[2], paddingHorizontal: space[3], textAlign: 'center' },
  headerGrid: { backgroundColor: c.ink4 },
  footer: { flexDirection: 'row', alignItems: 'stretch', minHeight: 44, backgroundColor: c.ink4 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowStriped: { backgroundColor: c.ink4 },
  rowSelected: { backgroundColor: c.ink4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[1], height: 40, paddingHorizontal: space[3], borderBottomWidth: 1, borderBottomColor: c.ink5 },
  headCompact: { height: 36 },
  headGrid: { borderBottomColor: c.ink8 },
  headText: { ...type(16, c.textSecondary, '500'), lineHeight: 22 },
  headTextCompact: { fontSize: 14, letterSpacing: font14, lineHeight: 18 },
  alignEnd: { justifyContent: 'flex-end' },
  divider: { borderRightWidth: 1, borderRightColor: c.ink8 },
  cell: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: space[3] },
  cellRowCompact: { minHeight: 36 },
  rule: { borderBottomWidth: 1, borderBottomColor: c.ink5 },
  ruleGrid: { borderBottomWidth: 1, borderBottomColor: c.ink8 },
  wash: { backgroundColor: c.ink4 },
  ring: { borderWidth: 2, borderColor: c.textPrimary },
  editing: { borderWidth: 2, borderColor: c.textPrimary, backgroundColor: c.surface },
  elevated: { borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  cellText: { ...type(14, c.textPrimary), lineHeight: 20 },
  cellCompact: { fontSize: 13, letterSpacing: -0.52, lineHeight: 18 },
  cellTitle: { fontWeight: '500' },
  cellMuted: { color: c.textSecondary },
  cellNumber: { fontVariant: ['tabular-nums'], fontWeight: '500' },
  cellMono: type(12, c.textSecondary, '400', true),
  sub: type(12, c.textSecondary),
  stack: { flex: 1, minWidth: 0, paddingVertical: space[1.5] },
  treeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: space[1.5] },
  tree: { alignItems: 'center', justifyContent: 'center', width: 16, height: 20 },
  treeName: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space[1.5], minWidth: 0 },
  treeSub: { ...type(12, c.textSecondary, '400', true), flexShrink: 1 },
  guide: { alignSelf: 'stretch', width: 20 },
  guideLine: { position: 'absolute', top: 0, bottom: 0, left: 10, width: StyleSheet.hairlineWidth * 2, backgroundColor: c.ink8 },
})
