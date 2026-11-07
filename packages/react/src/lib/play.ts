import { animate, scroll, type AnimationPlaybackControls } from 'motion'
// Only the standalone motion specs: this package is public, the transforms in core are not.
import { presetSpecs, reducedMotionSpec, type PresetSpec, type SpringToken } from '@fetaui/core/motion'
import type { Preset, Style } from './types'

// DOM runtime: plays a preset on an inline SVG, including the style layers from ANIMATION.md §4.
//
// Every preset plays by parts. The largest shape is the body. Details inside it or joined to it
// move rigidly with it; free details (sound waves, badges, dots) follow it with a short lag and
// a little extra swing. Draw traces the body first, then the details.

const SHAPES = 'path,circle,ellipse,rect,line,polyline,polygon,use'
const RISO_OFFSET = 1.4
const OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

type Keyframes = Record<string, number[]>

/**
 * One playIcon run: what is playing, and what puts the icon back if the run stops early. Motion
 * never resolves a cancelled animation, so the run waits on `halted` as well as on each step.
 */
type Job = {
  live: Set<{ cancel: () => void }>
  undo: Set<() => void | Promise<void>>
  halted: Promise<never>
  halt: () => void
  done: Promise<void>
}

const STOPPED = Symbol('stopped')
const jobs = new WeakMap<SVGSVGElement, Job>()

function newJob(): Job {
  let reject: (reason: symbol) => void = () => undefined
  const halted = new Promise<never>((_, fail) => { reject = fail })
  halted.catch(() => undefined)
  const live: Job['live'] = new Set()
  const halt = (): void => {
    for (const item of live) item.cancel()
    live.clear()
    reject(STOPPED)
  }
  return { live, undo: new Set(), halted, halt, done: Promise.resolve() }
}

const until = <T>(job: Job, work: Promise<T>): Promise<T> => Promise.race([work, job.halted])

/** Waits for `controls`, keeping them cancellable until they finish. */
const track = (job: Job, controls: AnimationPlaybackControls): Promise<void> => {
  job.live.add(controls)
  return until(job, controls.finished.then(() => { job.live.delete(controls) }))
}

// Every preset must end exactly at rest (ANIMATION.md §1). Motion keeps the last keyframe of each
// value (spin ends at rotate 360), so values are snapped back to rest after every run.
const REST = { x: 0, y: 0, scale: 1, scaleY: 1, rotate: 0, opacity: 1 }
const settle = async (el: Element): Promise<void> => { await animate(el, REST, { duration: 0 }) }

/** Seconds each free detail waits after the one before it. */
const LAG = 0.045
/** Free details overshoot the body by this factor (follow-through). */
const FOLLOW = 1.3
const MAX_STAGGER = 5
/** Detail endpoints closer than this to the body's outline are joined to it (viewBox units). */
const TOUCH = 1
export type PlayOptions = {
  preset: Preset
  style: Style
  dir: 1 | -1
  speed?: number
  /** `swap`: the second state holds until this settles instead of for a set time, so it stays exactly while a hover or focus lasts. */
  held?: Promise<unknown>
}

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isSpring = (ease: PresetSpec['ease']): ease is SpringToken => typeof ease === 'object' && !Array.isArray(ease)
const tweenEase = (ease: PresetSpec['ease']): [number, number, number, number] | 'linear' =>
  isSpring(ease) ? OUT : ease === 'linear' ? 'linear' : [...ease]

function keyframesFor(spec: PresetSpec, opts: PlayOptions): Keyframes {
  const out: Keyframes = {}
  for (const [prop, values] of Object.entries(spec.keyframes)) out[prop] = [...values]
  if (opts.preset === 'slide' && out.x) out.x = out.x.map((v) => v * opts.dir)
  return out
}

// Every visible shape draws, in every style and layer (ANIMATION.md §4). The hidden second state
// of a two-state icon is not visible, so presets other than swap leave it alone.
const drawable = (svg: SVGSVGElement): SVGGraphicsElement[] =>
  [...svg.querySelectorAll<SVGGraphicsElement>(SHAPES)].filter((s) => !s.closest('defs, clipPath, [data-feta-state="active"]'))

/** The state groups of a two-state icon (DESIGN.md §2.1), or null when it has one state. */
function statesOf(svg: SVGSVGElement): { rest: SVGGElement[]; active: SVGGElement[] } | null {
  const active = [...svg.querySelectorAll<SVGGElement>('g[data-feta-state="active"]')]
  if (!active.length) return null
  return { rest: [...svg.querySelectorAll<SVGGElement>('g[data-feta-state="rest"]')], active }
}

/** Icons without a second state play this instead of swap. */
const STATELESS_FALLBACK: Preset = 'draw'

/** Layered styles draw shared geometry through <use>; pathLength belongs on the referenced shape. */
function geometryOf(shape: SVGGraphicsElement): Element {
  if (shape.tagName !== 'use') return shape
  const id = shape.getAttribute('href')?.slice(1)
  return (id && shape.ownerSVGElement?.querySelector(`[id="${CSS.escape(id)}"]`)) || shape
}

type Drawn = { shape: SVGGraphicsElement; filled: boolean; reset: () => void }

/** Geometry currently drawing: its original pathLength and how many shapes still use it. */
const drawing = new WeakMap<Element, { saved: string | null; users: number }>()

/**
 * Prepares one shape to draw on. Strokes trace as usual. Filled shapes trace their outline in
 * their own color, then the fill fades in, so Outlined, Filled, Pixel, Riso plates and Glass
 * bodies draw like every other style.
 */
function prepareDraw(shape: SVGGraphicsElement): Drawn {
  const geometry = geometryOf(shape)
  const cs = getComputedStyle(shape)
  const filled = cs.fill !== 'none' && cs.fill !== 'rgba(0, 0, 0, 0)'
  const stroked = cs.stroke !== 'none' && cs.stroke !== 'rgba(0, 0, 0, 0)'
  // Generated styles carry their own inline colors (Filled knockouts, Riso ink), so reset
  // restores the original style attribute instead of clearing properties.
  const savedStyle = shape.getAttribute('style')
  // Neon and Glass layers share one geometry through <use>: save its pathLength once and put it
  // back when the last layer using it resets.
  const held = drawing.get(geometry) ?? { saved: geometry.getAttribute('pathLength'), users: 0 }
  held.users++
  drawing.set(geometry, held)
  geometry.setAttribute('pathLength', '1')
  if (!stroked) {
    shape.style.stroke = cs.fill
    shape.style.strokeWidth = '1'
    shape.style.strokeLinejoin = 'round'
  }
  // Dash properties inherit through <use>, so they stay on the visible element.
  shape.style.strokeDasharray = '1 1'
  shape.style.strokeDashoffset = '1'
  if (filled) shape.style.fillOpacity = '0'
  return {
    shape,
    filled,
    reset: () => {
      if (--held.users === 0) {
        drawing.delete(geometry)
        if (held.saved === null) geometry.removeAttribute('pathLength')
        else geometry.setAttribute('pathLength', held.saved)
      }
      if (savedStyle === null) shape.removeAttribute('style')
      else shape.setAttribute('style', savedStyle)
    },
  }
}

/** Motion springs take two keyframes, so [rest, peak, rest] tweens to the peak, then springs home. */
async function run(job: Job, el: Element, keyframes: Keyframes, spec: PresetSpec): Promise<void> {
  if (!isSpring(spec.ease)) {
    await track(job, animate(el, keyframes, { duration: spec.duration, ease: tweenEase(spec.ease) }))
    return
  }
  const toPeak: Keyframes = {}
  const settle: Keyframes = {}
  for (const [k, v] of Object.entries(keyframes)) { toPeak[k] = v.slice(0, -1); settle[k] = v.slice(-2) }
  await track(job, animate(el, toPeak, { duration: spec.duration * 0.35, ease: OUT }))
  await track(job, animate(el, settle, { type: 'spring', stiffness: spec.ease.stiffness, damping: spec.ease.damping }))
}

function styleLayers(job: Job, svg: SVGSVGElement): Promise<unknown>[] {
  const runs: Promise<unknown>[] = []
  const plate = svg.querySelector<SVGGElement>('[data-feta="plate"]')
  if (plate) {
    const o = `translate(${RISO_OFFSET}px, ${RISO_OFFSET}px)`
    const slide = plate.animate([{ transform: o }, { transform: 'translate(0px, 0px)' }, { transform: o }], { duration: 400, easing: 'cubic-bezier(0.65,0,0.35,1)' })
    job.live.add(slide)
    // A cancelled native animation rejects `finished` with an AbortError; that is a stop, not a failure.
    runs.push(slide.finished.then(() => job.live.delete(slide), () => undefined))
  }
  const highlight = svg.querySelector('[data-feta="highlight"]')
  const ref = highlight?.getAttribute('stroke')?.match(/url\(#(.+)\)/)?.[1]
  const gradient = ref ? svg.querySelector(`[id="${ref}"]`) : null
  if (gradient) {
    const y1 = Number(gradient.getAttribute('y1'))
    const span = Number(gradient.getAttribute('y2')) - y1
    const clear = (): void => gradient.removeAttribute('gradientTransform')
    job.undo.add(clear)
    runs.push(
      track(job, animate(-1, 1, { duration: 0.5, ease: OUT, onUpdate: (v) => gradient.setAttribute('gradientTransform', `translate(0 ${v * span * 1.6})`) })).then(() => {
        job.undo.delete(clear)
        clear()
      }),
    )
  }
  return runs
}

// Part roles.

type Box = { x: number; y: number; w: number; h: number }
type Part = { shapes: SVGGraphicsElement[]; role: 'body' | 'detail'; rigid: boolean }

const boxOf = (shape: SVGGraphicsElement): Box => {
  const b = shape.getBBox()
  return { x: b.x, y: b.y, w: b.width, h: b.height }
}

/** Layers of one shape (Two tone tint, Riso plate, Neon glow) have near equal boxes: one part. */
const sameShape = (a: Box, b: Box): boolean =>
  Math.abs(a.w - b.w) < 0.6 && Math.abs(a.h - b.h) < 0.6 && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2

const pathOf = (shape: SVGGraphicsElement): SVGGeometryElement | null => {
  const g = geometryOf(shape)
  return g instanceof SVGGeometryElement ? g : null
}

function outlineOf(path: SVGGeometryElement, step = 0.5): DOMPoint[] {
  const length = path.getTotalLength()
  const points: DOMPoint[] = []
  for (let at = 0; at <= length; at += step) points.push(path.getPointAtLength(at))
  return points
}

/** True when either end of `detail` lies on the body's outline (an outline split into two paths). */
function touches(detail: SVGGeometryElement, outline: readonly DOMPoint[]): boolean {
  const length = detail.getTotalLength()
  return [detail.getPointAtLength(0), detail.getPointAtLength(length)].some((end) =>
    outline.some((p) => Math.hypot(p.x - end.x, p.y - end.y) < TOUCH),
  )
}

/** Groups shapes into parts, largest first. A detail is rigid when it sits inside the body's box or touches it. */
function partsOf(svg: SVGSVGElement): Part[] {
  const groups: { box: Box; shapes: SVGGraphicsElement[] }[] = []
  for (const shape of drawable(svg)) {
    const box = boxOf(shape)
    const group = groups.find((g) => sameShape(g.box, box))
    if (group) group.shapes.push(shape)
    else groups.push({ box, shapes: [shape] })
  }
  const area = (b: Box): number => Math.max(b.w, 1) * Math.max(b.h, 1)
  groups.sort((a, b) => area(b.box) - area(a.box))
  const body = groups[0]?.box
  const within = (b: Box): boolean =>
    !!body && b.x >= body.x - 0.5 && b.y >= body.y - 0.5 && b.x + b.w <= body.x + body.w + 0.5 && b.y + b.h <= body.y + body.h + 0.5
  const bodyPath = groups[0]?.shapes[0] && pathOf(groups[0].shapes[0])
  // Sampling is costly and most details sit inside the body box, so it waits until a detail needs it.
  let sampled: DOMPoint[] | undefined
  const bodyOutline = (): DOMPoint[] => (sampled ??= bodyPath ? outlineOf(bodyPath) : [])
  return groups.map((g, i) => {
    const path = g.shapes[0] && pathOf(g.shapes[0])
    const rigid = i > 0 && (within(g.box) || (!!path && touches(path, bodyOutline())))
    return { shapes: g.shapes, role: i === 0 ? 'body' : 'detail', rigid }
  })
}

const follows = (part: Part): boolean => part.role === 'detail' && !part.rigid

/** Lag in seconds for each part: 0 for the body and rigid details, growing for free details. */
function lagsOf(parts: readonly Part[]): number[] {
  let follower = 0
  return parts.map((part) => (follows(part) ? Math.min(++follower, MAX_STAGGER) * LAG : 0))
}

/**
 * Scales each keyframe's distance from rest, so free details swing further than the body.
 * Only values that return to rest are scaled: spin ends a full turn on, and 1.3 turns would not.
 */
function amplify(keyframes: Keyframes, factor: number): Keyframes {
  const out: Keyframes = {}
  for (const [prop, values] of Object.entries(keyframes)) {
    const rest = values[0] ?? 0
    const returns = values[values.length - 1] === rest
    out[prop] = prop === 'opacity' || !returns ? values : values.map((v) => rest + (v - rest) * factor)
  }
  return out
}

/** Draw window for part `i` as fractions of the preset duration: the body first, then details. */
function drawWindow(i: number): { start: number; end: number } {
  if (i === 0) return { start: 0, end: 0.75 }
  const start = 0.35 + Math.min(i - 1, MAX_STAGGER) * 0.12
  return { start, end: start + 0.5 }
}

/** The preset's transform origin as a point on the 24 px grid ('top center' is the top edge). */
function pivotOf(origin: string): { x: number; y: number } {
  const words = origin.split(/\s+/)
  const y = words.includes('top') ? 0 : words.includes('bottom') ? 24 : 12
  const x = words.includes('left') ? 0 : words.includes('right') ? 24 : 12
  return { x, y }
}

/**
 * Motion renders SVG transforms in the element's own box, so the shared pivot is passed as an
 * origin relative to that box. Every part then turns and scales around the same point.
 */
const pinToPivot = (shape: SVGGraphicsElement, pivot: { x: number; y: number }): AnimationPlaybackControls => {
  const b = shape.getBBox()
  return animate(shape, { originX: `${pivot.x - b.x}px`, originY: `${pivot.y - b.y}px` }, { duration: 0 })
}

const wait = (s: number): Promise<void> => new Promise((r) => setTimeout(r, s * 1000))
const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

const restoreStyle = (shape: Element, saved: string | null): void => {
  if (saved === null) shape.removeAttribute('style')
  else shape.setAttribute('style', saved)
}

/** Motion writes styles on its next frame, so the original goes back only after that write. */
const backToRest = async (el: Element, saved: string | null): Promise<void> => {
  await settle(el)
  await frame()
  await frame()
  restoreStyle(el, saved)
}

async function drawParts(job: Job, parts: readonly Part[], spec: PresetSpec): Promise<void> {
  const d = spec.duration
  const ease = tweenEase(spec.ease)
  await Promise.all(
    parts.flatMap((part, i) => {
      const { start, end } = drawWindow(i)
      const duration = (end - start) * d
      return part.shapes.map(async (shape) => {
        const { filled, reset } = prepareDraw(shape)
        shape.style.opacity = '0'
        // Motion remembers the last value it wrote, so a stop snaps to the drawn pose before the reset.
        const undo = async (): Promise<void> => {
          await animate(shape, { strokeDashoffset: 0, opacity: 1, ...(filled ? { fillOpacity: 1 } : {}) }, { duration: 0 })
          await frame()
          await frame()
          reset()
        }
        job.undo.add(undo)
        await until(job, wait(start * d))
        await Promise.all([
          track(job, animate(shape, { strokeDashoffset: [1, 0] }, { duration, ease })),
          track(job, animate(shape, { opacity: [0, 1] }, { duration: 0.06 })),
          ...(filled ? [track(job, animate(shape, { fillOpacity: [0, 0, 1] }, { duration, times: [0, 0.45, 1], ease: 'easeOut' }))] : []),
        ])
        job.undo.delete(undo)
        reset()
      })
    }),
  )
}

async function moveParts(job: Job, parts: readonly Part[], spec: PresetSpec, opts: PlayOptions): Promise<void> {
  const base = keyframesFor(spec, opts)
  const pivot = pivotOf(spec.origin)
  const lags = lagsOf(parts)
  await Promise.all(
    parts.flatMap((part, i) => {
      const keyframes = follows(part) ? amplify(base, FOLLOW) : base
      return part.shapes.map(async (shape) => {
        const saved = shape.getAttribute('style')
        const undo = (): Promise<void> => backToRest(shape, saved)
        job.undo.add(undo)
        await track(job, pinToPivot(shape, pivot))
        await until(job, wait(lags[i] ?? 0))
        await run(job, shape, keyframes, spec)
        await undo()
        job.undo.delete(undo)
      })
    }),
  )
}

/** The centre of every state group together, so both states fold about one line in every style. */
function stateCentre(groups: readonly SVGGElement[]): { x: number; y: number } {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const g of groups) {
    const b = g.getBBox()
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height)
  }
  return Number.isFinite(x0) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } : { x: 12, y: 12 }
}

/**
 * Swap (ANIMATION.md §3): the rest state folds flat and fades as the second state opens out of the
 * same line, holds, then the two trade back. The hold lasts its share of the duration or, when the
 * trigger is held, until `held` settles. Reduced motion keeps the state change as a 150 ms cross-fade
 * with no transform (ANIMATION.md §6).
 */
async function swapStates(job: Job, svg: SVGSVGElement, states: NonNullable<ReturnType<typeof statesOf>>, spec: PresetSpec, opts: PlayOptions): Promise<void> {
  const reduce = prefersReducedMotion()
  const times = spec.times ?? [0, 0.15, 0.85, 1]
  const at = (i: number): number => times[i] ?? i / 3
  const pivot = stateCentre([...states.rest, ...states.active])
  const groups = [
    ...states.rest.map((g) => ({ g, keyframes: spec.keyframes })),
    ...states.active.map((g) => ({ g, keyframes: spec.active ?? {} })),
  ].map(({ g, keyframes }) => ({ g, keyframes, saved: g.getAttribute('style') }))
  const undo = async (): Promise<void> => {
    await Promise.all(groups.map(({ g }) => animate(g, { opacity: 1, scaleY: 1 }, { duration: 0 })))
    await frame()
    await frame()
    for (const { g, saved } of groups) restoreStyle(g, saved)
  }
  job.undo.add(undo)
  if (!reduce) await Promise.all(groups.map(({ g }) => track(job, pinToPivot(g, pivot))))
  // One leg: every group to keyframe `to`, in the time between offsets `from` and `to`.
  const leg = (from: number, to: number, seconds: number): Promise<unknown> =>
    Promise.all(groups.map(({ g, keyframes }) => {
      const target: Record<string, number> = {}
      for (const [prop, values] of Object.entries(keyframes)) {
        if (reduce && prop !== 'opacity') continue
        const value = values?.[to]
        if (value !== undefined) target[prop] = value
      }
      return track(job, animate(g, target, { duration: Math.max(seconds, 0), ease: reduce ? 'linear' : tweenEase(spec.ease) }))
    }))
  // The start pose: the second state hidden by its attribute, now held by style so it can fade in.
  await Promise.all(groups.map(({ g, keyframes }) => {
    const start: Record<string, number> = {}
    for (const [prop, values] of Object.entries(keyframes)) if (values?.[0] !== undefined && (!reduce || prop === 'opacity')) start[prop] = values[0]
    return track(job, animate(g, start, { duration: 0 }))
  }))
  const span = (a: number, b: number): number => (reduce ? reducedMotionSpec.duration : (at(b) - at(a)) * spec.duration)
  await leg(0, 1, span(0, 1))
  // A held trigger sets the hold exactly, like the owner's original; otherwise it lasts its share of the duration.
  await until(job, opts.held ? Promise.resolve(opts.held).catch(() => undefined) : wait((at(2) - at(1)) * spec.duration))
  await leg(2, 3, span(2, 3))
  await undo()
  job.undo.delete(undo)
}

async function perform(job: Job, svg: SVGSVGElement, opts: PlayOptions): Promise<void> {
  const states = presetSpecs[opts.preset].target === 'state' ? statesOf(svg) : null
  if (states) {
    const base = presetSpecs[opts.preset]
    const spec = { ...base, duration: base.duration / (opts.speed ?? 1) }
    await Promise.all([swapStates(job, svg, states, spec, opts), ...(prefersReducedMotion() ? [] : styleLayers(job, svg))])
    return
  }
  if (presetSpecs[opts.preset].target === 'state') opts = { ...opts, preset: STATELESS_FALLBACK }
  // Reduced motion is a single opacity cue on the whole icon (ANIMATION.md §6).
  if (prefersReducedMotion()) {
    const saved = svg.getAttribute('style')
    const undo = (): Promise<void> => backToRest(svg, saved)
    job.undo.add(undo)
    await run(job, svg, keyframesFor(reducedMotionSpec, opts), reducedMotionSpec)
    await undo()
    job.undo.delete(undo)
    return
  }
  const base = presetSpecs[opts.preset]
  const spec = { ...base, duration: base.duration / (opts.speed ?? 1) }
  const layers = styleLayers(job, svg)
  const parts = partsOf(svg)
  await Promise.all([spec.target === 'paths' ? drawParts(job, parts, spec) : moveParts(job, parts, spec, opts), ...layers])
}

/** Plays one preset. Resolves at rest, also after stopIcon. An icon already playing keeps its run. */
export function playIcon(svg: SVGSVGElement, opts: PlayOptions): Promise<void> {
  const running = jobs.get(svg)
  if (running) return running.done
  const job = newJob()
  jobs.set(svg, job)
  job.done = perform(job, svg, opts)
    .catch((error: unknown) => { if (error !== STOPPED) throw error })
    .finally(async () => {
      await Promise.all([...job.undo].map((undo) => undo()))
      jobs.delete(svg)
    })
  return job.done
}

/** Cancels the icon's run and returns it to rest. Resolves once it is there. */
export function stopIcon(svg: SVGSVGElement): Promise<void> {
  const job = jobs.get(svg)
  if (!job) return Promise.resolve()
  job.halt()
  return job.done
}

/** Neon glow flickers in on mount (ANIMATION.md §4). */
export function flickerNeon(svg: SVGSVGElement): void {
  const glow = svg.querySelector<SVGGElement>('[data-feta="glow-outer"]')
  if (!glow || prefersReducedMotion()) return
  glow.animate([0, 0.8, 0.3, 1].map((v) => ({ opacity: v * 0.55 })), { duration: 400, easing: 'linear' })
}

/**
 * Keyframes that hold `from` until `start`, reach `to` at `end` and hold it after, as fractions
 * of a scroll-linked timeline.
 */
function windowed(from: number, to: number, start: number, end: number): { values: number[]; times: number[] } {
  const points: [number, number][] = [[0, from]]
  if (start > 0) points.push([Math.min(start, 0.999), from])
  points.push([Math.min(end, 1), to])
  if (end < 1) points.push([1, to])
  return { values: points.map((p) => p[1]), times: points.map((p) => p[0]) }
}

/** Delays a keyframe list by `start` of the timeline, spreading the rest evenly after it. */
function delayed(keyframes: Keyframes, start: number): { keyframes: Keyframes; times?: number[] } {
  if (start <= 0) return { keyframes }
  const out: Keyframes = {}
  let times: number[] = []
  for (const [prop, values] of Object.entries(keyframes)) {
    const n = values.length
    out[prop] = [values[0] ?? 0, ...values]
    times = [0, start, ...values.slice(1).map((_, j) => start + ((1 - start) * (j + 1)) / (n - 1))]
  }
  return { keyframes: out, times }
}

/**
 * Scrubs the preset with the page scroll: it plays as `target` moves from the bottom of the
 * viewport to the middle, by parts like every other run. Springs cannot be scrubbed, so
 * keyframes run linearly. Returns cleanup.
 */
export function linkToScroll(svg: SVGSVGElement, target: Element, opts: PlayOptions): () => void {
  const options = { target, offset: ['start end', 'center center'] as ['start end', 'center center'] }
  const linked: { stop: VoidFunction; animation: AnimationPlaybackControls }[] = []
  const resets: VoidFunction[] = []
  const link = (animation: AnimationPlaybackControls): void => {
    linked.push({ stop: scroll(animation, options), animation })
  }
  const states = presetSpecs[opts.preset].target === 'state' ? statesOf(svg) : null
  if (states) {
    // Swap scrubs from rest to the second state, which it shows once the target reaches the middle.
    const spec = presetSpecs[opts.preset]
    const reduce = prefersReducedMotion()
    const pivot = stateCentre([...states.rest, ...states.active])
    const groups = [...states.rest.map((g) => ({ g, k: spec.keyframes })), ...states.active.map((g) => ({ g, k: spec.active ?? {} }))]
    for (const { g, k } of groups) {
      const saved = g.getAttribute('style')
      resets.push(() => restoreStyle(g, saved))
      if (!reduce) void pinToPivot(g, pivot)
      const keyframes: Keyframes = {}
      for (const [prop, values] of Object.entries(k)) if (values && (!reduce || prop === 'opacity')) keyframes[prop] = values.slice(0, 2)
      link(animate(g, keyframes, { ease: 'linear' }))
    }
  } else if (prefersReducedMotion()) {
    link(animate(svg, keyframesFor(reducedMotionSpec, opts), { ease: 'linear' }))
  } else {
    const spec = presetSpecs[presetSpecs[opts.preset].target === 'state' ? STATELESS_FALLBACK : opts.preset]
    const parts = partsOf(svg)
    if (spec.target === 'paths') {
      const total = drawWindow(Math.min(parts.length - 1, MAX_STAGGER + 1)).end
      parts.forEach((part, i) => {
        const { start, end } = drawWindow(i)
        const [s, e] = [start / total, end / total]
        for (const shape of part.shapes) {
          const d = prepareDraw(shape)
          resets.push(d.reset)
          const dash = windowed(1, 0, s, e)
          const shown = windowed(0, 1, s, s + 0.02)
          link(animate(shape, { strokeDashoffset: dash.values }, { ease: 'linear', times: dash.times }))
          link(animate(shape, { opacity: shown.values }, { ease: 'linear', times: shown.times }))
          if (d.filled) {
            const fill = windowed(0, 1, s + 0.45 * (e - s), e)
            link(animate(shape, { fillOpacity: fill.values }, { ease: 'linear', times: fill.times }))
          }
        }
      })
    } else {
      const base = keyframesFor(spec, opts)
      const pivot = pivotOf(spec.origin)
      const lags = lagsOf(parts)
      parts.forEach((part, i) => {
        const { keyframes, times } = delayed(follows(part) ? amplify(base, FOLLOW) : base, (lags[i] ?? 0) / spec.duration)
        for (const shape of part.shapes) {
          const saved = shape.getAttribute('style')
          resets.push(() => restoreStyle(shape, saved))
          void pinToPivot(shape, pivot)
          link(animate(shape, keyframes, { ease: 'linear', ...(times ? { times } : {}) }))
        }
      })
    }
  }
  return () => {
    for (const { stop, animation } of linked) { stop(); animation.cancel() }
    for (const reset of resets) reset()
  }
}

export const isLoop = (preset: Preset): boolean => presetSpecs[preset].loop
export const LOOP_PAUSE_MS = 400
