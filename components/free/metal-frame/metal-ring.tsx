'use client'
import { useEffect, useRef, type CSSProperties, type MutableRefObject } from 'react'
import { cx } from '../motion-kit/motion-kit'
import { lerp } from '../../motion-tokens'
import styles from './metal-ring.module.css'

/*
 * The chrome ring shared by Metal Frame and Bezel Frame. A WebGL fragment shader draws a band just inside
 * the parent's rounded edge: light and dark bands drift slowly round it, a bright lip sits on the outer
 * edge, and near a mouse pointer the edge swells outward. Without WebGL, or when still, a static CSS ring
 * takes its place. The ring measures and listens to its parent, so the parent must be positioned.
 */

/** How far the canvas reaches past the box, in CSS px, so a bend has room to swell outward. */
const MARGIN = 10
/** Highest pixel ratio the canvas renders at. The ring is 1.5 px, so 2 is already crisp. */
const DPR_CAP = 2
/** Drift rate of the bands, in turns per second at speed 1. About 8 s a turn, as the old ring ran. */
const DRIFT = 0.12
/** The pointer bends the ring from this far outside the box, in CSS px. */
const BEND_REACH = 48
/** How far the edge swells toward the pointer, in CSS px. */
const BEND_PX = 3
/** Spread of the swell along the edge, in CSS px. */
const BEND_SPREAD = 38
/** Seconds a ring keeps its GL context after leaving the screen, so scrolling past does not churn. */
const RELEASE_AFTER = 2000
/** Per frame ease at 60 fps for the bend, strength and speed (`lerp['ring-bend']`, 0.15). About 240 ms to settle. */
const EASE = lerp['ring-bend']
/** At this many live GL contexts, rings waiting out RELEASE_AFTER offscreen let theirs go first. Browsers cap at 16. */
const CONTEXT_CAP = 8

/** GL contexts held by rings on the page right now. */
let liveContexts = 0
/** Release now, for rings that left the screen and still hold a context. */
const pendingRelease = new Set<() => void>()

const VERTEX = `attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`

const FRAGMENT = `precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uBox;
uniform float uRadius;
uniform float uRing;
uniform float uPixel;
uniform vec2 uPointer;
uniform float uBend;
uniform float uStrength;
uniform float uDark;
uniform float uTint;
uniform vec3 uTintLight;
uniform vec3 uTintDeep;

float boxDistance(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uPixel - ${MARGIN.toFixed(1)} - uBox * 0.5;
  vec2 halfSize = uBox * 0.5;
  float r = min(uRadius, min(halfSize.x, halfSize.y));
  vec2 toPointer = p - (uPointer - halfSize);
  float near = exp(-dot(toPointer, toPointer) / (2.0 * ${BEND_SPREAD.toFixed(1)} * ${BEND_SPREAD.toFixed(1)}));
  float d = boxDistance(p, halfSize, r) - near * uBend * ${BEND_PX.toFixed(1)};
  float aa = 0.75;
  float band = smoothstep(-uRing - aa, -uRing + aa, d) * (1.0 - smoothstep(-aa, aa, d));
  if (band <= 0.001) { gl_FragColor = vec4(0.0); return; }

  float around = atan(p.y, p.x) / 6.2831853 + 0.5;
  float across = clamp((d + uRing) / max(uRing, 0.001), 0.0, 1.0);
  float t = uTime * ${DRIFT.toFixed(2)};
  float chrome = 0.5
    + 0.32 * sin((around + t) * 6.2831853 * 3.0)
    + 0.18 * sin((around - t * 0.7) * 6.2831853 * 7.0 + 1.3)
    + 0.12 * sin(p.x * 0.05 + p.y * 0.08 + uTime * 0.4);
  chrome += near * uBend * 0.35;
  chrome += (across - 0.5) * 0.5;
  chrome = clamp(chrome, 0.0, 1.0);
  vec3 deep = mix(vec3(0.55), vec3(0.16), uDark);
  vec3 light = mix(vec3(0.99), vec3(1.0), uDark);
  vec3 chromeColour = mix(deep, light, smoothstep(0.15, 0.9, chrome));
  vec3 tinted = mix(uTintDeep, mix(uTintLight, vec3(1.0), 0.35), smoothstep(0.15, 0.9, chrome));
  vec3 colour = mix(chromeColour, tinted, uTint);
  float alpha = band * mix(0.5, 0.92, uStrength) * mix(0.85, 1.0, uDark);
  gl_FragColor = vec4(colour * alpha, alpha);
}`

export type MetalRingTint = 'chrome' | 'sky'

export type MetalRingProps = {
  /** Corner radius in px. Left out, the ring follows the parent's computed border radius. */
  borderRadius?: number | undefined
  /** Band width in px. Default 1.5. */
  ringCssPx?: number | undefined
  /** How bright and solid the metal is, 0 to 1. Changes ease in. Default 1. */
  strength?: number | undefined
  /** Drift multiplier. 1 is the rest drift; thinking runs faster. Default 1. */
  speed?: number | undefined
  /** Holds the bands where they are. The bend still follows the pointer. */
  paused?: boolean | undefined
  /** Swells the edge toward a mouse pointer. Default true. */
  bend?: boolean | undefined
  /** Chrome, or chrome washed in the sky and blue tokens. Default `chrome`. */
  tint?: MetalRingTint | undefined
  /** Forces the palette. Left out, it follows the surface token under the ring. */
  theme?: 'light' | 'dark' | undefined
  /** Draws the static CSS ring only: no WebGL, no drift, no bend. */
  still?: boolean | undefined
  className?: string | undefined
}

type Live = { props: MetalRingProps; wake: (() => void) | null; retheme: (() => void) | null; remeasure: (() => void) | null }

/** Absolutely placed over its parent's edge. Decorative, so it is hidden from assistive tech. */
export function MetalRing(props: MetalRingProps) {
  const { ringCssPx = 1.5, tint = 'chrome', still = false, className } = props
  const host = useRef<HTMLSpanElement>(null)
  const live = useRef<Live>({ props, wake: null, retheme: null, remeasure: null })
  live.current.props = props
  const { strength, speed, paused, bend, theme, borderRadius } = props

  // New props are read on the next frame; wake a held loop so it draws them. Size and theme have their own observers.
  useEffect(() => { live.current.wake?.() }, [strength, speed, paused, bend, tint, theme, borderRadius, ringCssPx])
  useEffect(() => { live.current.retheme?.() }, [theme, tint])
  useEffect(() => { live.current.remeasure?.() }, [borderRadius, ringCssPx])

  useEffect(() => {
    const node = host.current
    if (still || !node) return
    return mountRing(node, live)
  }, [still])

  const style = { '--ring-width': `${ringCssPx}px` } as CSSProperties
  return (
    <span ref={host} aria-hidden="true" className={cx(styles.ring, className)} data-tint={tint} style={style}>
      <span className={styles.fallback} />
    </span>
  )
}

const hexOrRgb = (value: string): [number, number, number] | null => {
  const text = value.trim()
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join('') : hex.slice(0, 6)
    return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255) as [number, number, number]
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(text)?.[1]
  if (rgb) {
    const parts = rgb.split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((n) => parseFloat(n) / 255)
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) return parts as [number, number, number]
  }
  return null
}

const luminance = ([r, g, b]: [number, number, number]): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  gl.deleteShader(shader)
  return null
}

type Gl = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  program: WebGLProgram
  shaders: WebGLShader[]
  buffer: WebGLBuffer | null
  at: Map<string, WebGLUniformLocation | null>
}

function createGl(): Gl | null {
  const canvas = document.createElement('canvas')
  canvas.className = styles.canvas ?? ''
  canvas.setAttribute('aria-hidden', 'true')
  let gl: WebGLRenderingContext | null
  try {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
  } catch {
    gl = null
  }
  if (!gl) return null
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  // Any failure past getContext frees what exists and drops the context, so retries cannot pile up.
  const fail = (context: WebGLRenderingContext): null => {
    if (vertex) context.deleteShader(vertex)
    if (fragment) context.deleteShader(fragment)
    if (program) context.deleteProgram(program)
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }
  if (!vertex || !fragment || !program) return fail(gl)
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return fail(gl)
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  return { canvas, gl, program, shaders: [vertex, fragment], buffer, at: new Map() }
}

function releaseGl(g: Gl): void {
  const { gl } = g
  gl.deleteBuffer(g.buffer)
  for (const shader of g.shaders) gl.deleteShader(shader)
  gl.deleteProgram(g.program)
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  g.canvas.remove()
}

/** Runs one ring. Returns its cleanup. The GL context exists only while the ring is on screen. */
function mountRing(host: HTMLSpanElement, live: MutableRefObject<Live>): () => void {
  const frame = host.parentElement
  if (!frame) return () => {}
  const state = {
    width: 1, height: 1, radius: 0, pointerX: -1e4, pointerY: -1e4,
    bend: 0, bendTo: 0, strength: live.current.props.strength ?? 1, speed: live.current.props.speed ?? 1,
    dark: 0, tintLight: [0.22, 0.74, 0.97] as [number, number, number], tintDeep: [0.11, 0.31, 0.85] as [number, number, number],
    time: Math.random() * 100,
  }
  let g: Gl | null = null
  let raf = 0
  let last = 0
  let onScreen = false
  let releaseTimer = 0
  const releaseNow = (): void => {
    window.clearTimeout(releaseTimer)
    stop()
  }
  /** Set when WebGL setup fails once. The static CSS ring stays and setup is never retried. */
  let failed = false

  const measure = (): void => {
    state.width = frame.offsetWidth
    state.height = frame.offsetHeight
    const fixed = live.current.props.borderRadius
    state.radius = fixed ?? (parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0)
  }

  const readTheme = (): void => {
    const css = getComputedStyle(host)
    const forced = live.current.props.theme
    const surface = hexOrRgb(css.color)
    state.dark = forced ? (forced === 'dark' ? 1 : 0) : surface && luminance(surface) < 0.5 ? 1 : 0
    state.tintLight = hexOrRgb(css.getPropertyValue('--ring-tint-light')) ?? state.tintLight
    state.tintDeep = hexOrRgb(css.getPropertyValue('--ring-tint-deep')) ?? state.tintDeep
  }

  const sizeCanvas = (canvas: HTMLCanvasElement): number => {
    const ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    const width = Math.max(1, Math.round((state.width + MARGIN * 2) * ratio))
    const height = Math.max(1, Math.round((state.height + MARGIN * 2) * ratio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    return ratio
  }

  const uniform = (name: string): WebGLUniformLocation | null => {
    if (!g) return null
    if (!g.at.has(name)) g.at.set(name, g.gl.getUniformLocation(g.program, name))
    return g.at.get(name) ?? null
  }

  const draw = (): void => {
    if (!g) return
    const { gl, canvas } = g
    const pixel = sizeCanvas(canvas)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(uniform('uResolution'), canvas.width, canvas.height)
    gl.uniform1f(uniform('uTime'), state.time)
    gl.uniform2f(uniform('uBox'), state.width, state.height)
    gl.uniform1f(uniform('uRadius'), state.radius)
    gl.uniform1f(uniform('uRing'), live.current.props.ringCssPx ?? 1.5)
    gl.uniform1f(uniform('uPixel'), pixel)
    gl.uniform2f(uniform('uPointer'), state.pointerX, state.pointerY)
    gl.uniform1f(uniform('uBend'), state.bend)
    gl.uniform1f(uniform('uStrength'), state.strength)
    gl.uniform1f(uniform('uDark'), state.dark)
    gl.uniform1f(uniform('uTint'), live.current.props.tint === 'sky' ? 1 : 0)
    gl.uniform3f(uniform('uTintLight'), ...state.tintLight)
    gl.uniform3f(uniform('uTintDeep'), ...state.tintDeep)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    host.toggleAttribute('data-gl', true)
  }

  const settled = (): boolean => {
    const p = live.current.props
    return Math.abs(state.bend - state.bendTo) < 0.002 && Math.abs(state.strength - (p.strength ?? 1)) < 0.002 && Math.abs(state.speed - (p.speed ?? 1)) < 0.002
  }

  const running = (): boolean => Boolean(g) && onScreen && document.visibilityState === 'visible' && (!live.current.props.paused || !settled())

  const tick = (now: number): void => {
    raf = 0
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
    last = now
    const p = live.current.props
    const k = 1 - Math.pow(1 - EASE, dt * 60)
    state.bend += (state.bendTo - state.bend) * k
    state.strength += ((p.strength ?? 1) - state.strength) * k
    state.speed += ((p.speed ?? 1) - state.speed) * k
    if (!p.paused) state.time += dt * state.speed
    draw()
    if (running()) raf = requestAnimationFrame(tick)
    else last = 0
  }

  const wake = (): void => {
    if (!g) return
    if (running()) {
      if (!raf) raf = requestAnimationFrame(tick)
    } else if (!raf) draw()
  }

  const onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || live.current.props.bend === false) {
      if (state.bendTo !== 0) { state.bendTo = 0; wake() }
      return
    }
    const rect = frame.getBoundingClientRect()
    state.pointerX = event.clientX - rect.left
    state.pointerY = event.clientY - rect.top
    const close = event.clientX > rect.left - BEND_REACH && event.clientX < rect.right + BEND_REACH && event.clientY > rect.top - BEND_REACH && event.clientY < rect.bottom + BEND_REACH
    const to = close ? 1 : 0
    if (to !== state.bendTo || close) { state.bendTo = to; wake() }
  }
  const onLeave = (event: PointerEvent): void => {
    if (event.relatedTarget === null && state.bendTo !== 0) { state.bendTo = 0; wake() }
  }

  const start = (): void => {
    window.clearTimeout(releaseTimer)
    pendingRelease.delete(releaseNow)
    if (g) { wake(); return }
    if (failed) return
    if (liveContexts >= CONTEXT_CAP) for (const release of [...pendingRelease]) release()
    g = createGl()
    if (!g) { failed = true; return }
    liveContexts += 1
    host.appendChild(g.canvas)
    measure()
    readTheme()
    g.canvas.addEventListener('webglcontextlost', onLost)
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onLeave, { passive: true })
    wake()
  }

  const stop = (): void => {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
    pendingRelease.delete(releaseNow)
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerout', onLeave)
    if (g) {
      g.canvas.removeEventListener('webglcontextlost', onLost)
      releaseGl(g)
      g = null
      liveContexts -= 1
    }
    host.removeAttribute('data-gl')
  }

  function onLost(event: Event): void {
    event.preventDefault()
    stop()
  }

  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = Boolean(entry?.isIntersecting)
    if (onScreen) start()
    else {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
      window.clearTimeout(releaseTimer)
      if (g) {
        releaseTimer = window.setTimeout(releaseNow, RELEASE_AFTER)
        pendingRelease.add(releaseNow)
      }
    }
  })
  const sizer = new ResizeObserver(() => { measure(); wake() })
  const themeWatch = new MutationObserver(() => { readTheme(); wake() })
  const scheme = window.matchMedia('(prefers-color-scheme: dark)')
  const onScheme = (): void => { readTheme(); wake() }
  const onVisibility = (): void => { last = 0; wake() }

  measure()
  readTheme()
  visibility.observe(frame)
  sizer.observe(frame)
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-platform'] })
  scheme.addEventListener('change', onScheme)
  document.addEventListener('visibilitychange', onVisibility)
  live.current.wake = wake
  live.current.retheme = () => { readTheme(); wake() }
  live.current.remeasure = () => { measure(); wake() }

  return () => {
    window.clearTimeout(releaseTimer)
    live.current.wake = null
    live.current.retheme = null
    live.current.remeasure = null
    visibility.disconnect()
    sizer.disconnect()
    themeWatch.disconnect()
    scheme.removeEventListener('change', onScheme)
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
  }
}
