// Cubic bezier easing as worklets, so the draw and swap curves run on the UI thread with the same tokens as web.

export type Ease = (t: number) => number

/** A cubic-bezier(x1, y1, x2, y2) curve: Newton steps on x, then y. */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  return (t: number): number => {
    'worklet'
    if (t <= 0) return 0
    if (t >= 1) return 1
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    let u = t
    for (let i = 0; i < 6; i++) {
      const x = ((ax * u + bx) * u + cx) * u - t
      const dx = (3 * ax * u + 2 * bx) * u + cx
      if (Math.abs(x) < 1e-5 || dx === 0) break
      u -= x / dx
    }
    return ((ay * u + by) * u + cy) * u
  }
}

export const linear: Ease = (t: number): number => {
  'worklet'
  return t
}

/** The token easings from core motion specs. */
export const easeOf = (e: readonly [number, number, number, number] | 'linear' | object): Ease =>
  Array.isArray(e) ? bezier(e[0] as number, e[1] as number, e[2] as number, e[3] as number) : linear
