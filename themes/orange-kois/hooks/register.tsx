import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

/*
 * Orange Kois: an orange, dark pixel-art theme for the Claude Code desktop app.
 *
 * Behind the conversation: a dark pond seen from above, with orange-and-white
 * pixel koi, amber-brown lily pads, and a slow current of ripples and soft
 * light drifting across the water. The koi follow curved
 * routes that never meet, at a steady pace, turning to face along them, their
 * tails beating gently; two circle a lotus.
 *
 * It is built the way the official theme-examples scenes are: one SVG with a
 * viewBox that fills any window, drawn as an interactive Svg, moved by CSS
 * animation in its own <style>, with nothing but translate, rotate and opacity
 * in its keyframes. Each route is one @keyframes, a list of places and
 * headings worked out here, that every koi on it shares.
 *
 * /orange-kois off turns the theme off and /orange-kois on brings it back;
 * the choice is remembered across sessions. The command is the theme's own,
 * so it sits beside other theme mods without answering for them.
 */

const SCENE = 'orange-kois'
const COMMAND = 'orange-kois'
// Where the choice is kept across sessions: 'off' when the person turned the theme off.
const CHOICE = 'choice'

// The pond is drawn on a 240 x 150 grid of big pixels, scaled to cover the window.
const W = 240
const H = 150

const WATER = '#140a05'

// Deterministic PRNG so the scene is the same on every draw.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number, places = 1) => {
  const k = 10 ** places
  return String(Math.round(n * k) / k)
}

// A sprite from rows of letters: each letter a color, '.' nothing.
function sprite(rows: string[], palette: Record<string, string>): string {
  const paths: Record<string, string> = {}
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      let end = x
      while (end < row.length && row[end] === ch) end++
      if (ch !== '.') paths[ch] = (paths[ch] ?? '') + `M${x} ${y}h${end - x}v1h${x - end}z`
      x = end
    }
  })
  return Object.entries(paths)
    .map(([ch, d]) => `<path fill="${palette[ch] ?? '#f0f'}" d="${d}"/>`)
    .join('')
}

// --- the koi ----------------------------------------------------------------

// A koi from above, nose to the right, 20 x 9.
const KOI = [
  '....................',
  'TT........FF........',
  'TTT...OOOWWWWWWO....',
  '.TTTOOOWWWWOOWWWWK..',
  '..TTOOWWWWOOOOWWWWWW',
  '.TTTOOOWWWWOOWWWWK..',
  'TTT...OOOWWWWWWO....',
  'TT........FF........',
  '....................',
]
const KOI_LENGTH = 20
const KOI_WIDTH = 9

// The koi in three pieces, so its body can flex: the head leads, the middle
// swings from the head, and the tail swings from the middle. Each piece laps
// the next by a column so no gap opens at a joint.
const cut = (from: number, to: number) => KOI.map(row => '.'.repeat(from) + row.slice(from, to) + '.'.repeat(row.length - to))
const HEAD = cut(12, 20)
const MIDDLE = cut(5, 13)
const TAIL = cut(0, 7)
// The joints, on the koi's spine.
const NECK: Point = [12, 4.5]
const HIP: Point = [6, 4.5]

const KOI_COLORS: Array<Record<string, string>> = [
  { W: '#f6e6d2', O: '#ff7a1a', T: '#ffb066', F: '#e8c9a6', K: '#1a0b05' },
  { W: '#ff8a2e', O: '#f6e6d2', T: '#ffc48a', F: '#ffb066', K: '#1a0b05' },
  { W: '#ffa040', O: '#d9480f', T: '#ffb066', F: '#ffb066', K: '#1a0b05' },
  { W: '#f6e6d2', O: '#d9480f', T: '#ff8a2e', F: '#e8c9a6', K: '#1a0b05' },
]

// --- the routes -------------------------------------------------------------

type Point = [x: number, y: number]

const circle = (cx: number, cy: number, r: number): Point[] =>
  Array.from({ length: 8 }, (_, i) => [cx + r * Math.cos((i * Math.PI) / 4), cy + r * Math.sin((i * Math.PI) / 4)] as Point)

// The routes koi swim: closed loops through these points, on the pond's grid.
// No two routes come within a koi's width of each other, and every koi on a
// route swims it at the same steady pace, so no koi ever meets or covers another.
const ROUTES = {
  // a long wavy lap around the pond
  lap: {
    seconds: 110,
    points: [[30, 40], [82, 26], [142, 32], [198, 27], [220, 55], [222, 97], [195, 121], [142, 129], [90, 123], [38, 124], [20, 90], [17, 58]] as Point[],
  },
  // a kidney-shaped loop on the left, swum the other way round
  loop: { seconds: 46, points: [[61, 76], [66, 90], [81, 94], [93, 87], [97, 73], [88, 62], [72, 62]] as Point[] },
  // a ring on the right, for two koi circling a lotus
  ring: { seconds: 32, points: circle(168, 76, 16.5) },
}
type Route = keyof typeof ROUTES

// A smooth closed curve through the points (Catmull-Rom), as many small steps,
// with how far along the curve each step is.
function trace(points: Point[]): { at: Point[]; along: number[]; length: number } {
  const n = points.length
  const at: Point[] = []
  const per = 40
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [points[(i + n - 1) % n]!, points[i]!, points[(i + 1) % n]!, points[(i + 2) % n]!]
    for (let s = 0; s < per; s++) {
      const t = s / per
      const c = (a: number, b: number, d: number, e: number) =>
        0.5 * (2 * b + (d - a) * t + (2 * a - 5 * b + 4 * d - e) * t * t + (3 * b - a - 3 * d + e) * t * t * t)
      at.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  const along = [0]
  for (let i = 1; i <= at.length; i++) {
    const a = at[i - 1]!
    const b = at[i % at.length]!
    along.push(along[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  return { at, along, length: along[at.length]! }
}

// One lap of a route at a steady pace: the koi's place and heading at evenly
// spaced moments. Headings keep counting past 360 so a turn never snaps back.
type Lap = { places: Point[]; headings: number[] }
const LAPS = new Map<Route, Lap>()
function lapOf(route: Route): Lap {
  const known = LAPS.get(route)
  if (known) return known
  const curve = trace(ROUTES[route].points)
  const moments = route === 'lap' ? 120 : 60
  const places: Point[] = []
  const headings: number[] = []
  let step = 0
  for (let m = 0; m <= moments; m++) {
    const far = (m / moments) * curve.length
    while (step < curve.at.length - 1 && curve.along[step + 1]! < far) step++
    const a = curve.at[step]!
    const b = curve.at[(step + 1) % curve.at.length]!
    const part = (far - curve.along[step]!) / (curve.along[step + 1]! - curve.along[step]!)
    let turn = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
    const before = headings[m - 1]
    if (before !== undefined) {
      while (turn - before > 180) turn -= 360
      while (turn - before < -180) turn += 360
    }
    places.push([a[0] + (b[0] - a[0]) * part, a[1] + (b[1] - a[1]) * part])
    headings.push(turn)
  }
  // The lap ends where it began, a whole turn on.
  places[moments] = places[0]!
  headings[moments] = headings[0]! + Math.round((headings[moments]! - headings[0]!) / 360) * 360
  const lap = { places, headings }
  LAPS.set(route, lap)
  return lap
}

// A route's lap as one @keyframes of translate and rotate.
function lapKeyframes(route: Route): string {
  const lap = lapOf(route)
  const last = lap.places.length - 1
  return `@keyframes ${route}{${lap.places
    .map(([x, y], m) => `${round((m / last) * 100, 2)}%{transform:translate(${round(x)}px,${round(y)}px) rotate(${round(lap.headings[m]!)}deg)}`)
    .join('')}}`
}

type Koi = {
  route: Route
  // Where in its lap the koi starts, and rests when nothing animates: 0 to 1.
  from: number
  // Seconds for one sweep of the tail from side to side.
  beat: number
  colors: number
}

const SCHOOL: Koi[] = [
  { route: 'lap', from: 0.04, beat: 0.95, colors: 0 },
  { route: 'lap', from: 0.37, beat: 1.05, colors: 2 },
  { route: 'lap', from: 0.7, beat: 0.9, colors: 3 },
  { route: 'loop', from: 0.1, beat: 1, colors: 1 },
  { route: 'loop', from: 0.6, beat: 1.1, colors: 0 },
  { route: 'ring', from: 0, beat: 0.9, colors: 3 },
  { route: 'ring', from: 0.5, beat: 0.9, colors: 1 },
]

// A piece that swings about a joint: the joint is put at the group's own
// origin, so the swing is a plain rotate.
const swinging = (className: string, joint: Point, rest: number, style: string, inner: string) =>
  `<g transform="translate(${joint[0]} ${joint[1]})"><g class="${className}" transform="rotate(${rest})" style="${style}"><g transform="translate(${-joint[0]} ${-joint[1]})">${inner}</g></g></g>`

function koi(k: Koi, i: number): string {
  const p = KOI_COLORS[k.colors]!
  const seconds = ROUTES[k.route].seconds
  const lap = lapOf(k.route)
  // Where it rests when nothing animates: its starting place, facing along the route, a little flexed.
  const moment = Math.round(k.from * (lap.places.length - 1))
  const [x, y] = lap.places[moment]!
  const flex = (i % 2 === 0 ? 1 : -1) * 6

  const beat = `animation-duration:${k.beat}s`
  // The tail trails the middle by a quarter of its sweep, which is what makes a wave of it.
  const tail = swinging('tail', HIP, flex, `${beat};animation-delay:-${round(i * 0.13 + k.beat / 2, 2)}s`, sprite(TAIL, p))
  const middle = swinging('middle', NECK, flex / 2, `${beat};animation-delay:-${round(i * 0.13, 2)}s`, sprite(MIDDLE, p) + tail)
  // The koi is drawn about its own middle, so it turns about it as its route bends.
  const fish = `<g transform="translate(${-KOI_LENGTH / 2} ${-KOI_WIDTH / 2})">${middle}${sprite(HEAD, p)}</g>`
  return (
    `<g class="swim" transform="translate(${round(x)} ${round(y)}) rotate(${round(lap.headings[moment]!)})" ` +
    `style="animation-name:${k.route};animation-duration:${seconds}s;animation-delay:-${round(k.from * seconds, 2)}s">${fish}</g>`
  )
}

// --- the pond ---------------------------------------------------------------

const PADS = {
  big: [
    '....RRRRR....',
    '..RRPPPPPRR..',
    '.RPPPPPPPPPR.',
    'RPPPPPPVPPPPR',
    'RPPPPPVPPPPPR',
    'RPPPPV...PPPR',
    'RPPPPPP...PPR',
    '.RPPPPPPPPPR.',
    '..RRPPPPPRR..',
    '....RRRRR....',
  ],
  small: ['..RRRRR..', '.RPPPPPR.', 'RPPPPVPPR', 'RPPPV.PPR', 'RPPP..PPR', 'RPPPPPPPR', '.RPPPPPR.', '..RRRRR..'],
  bud: ['.RRR.', 'RPPPR', 'RPVPR', 'RPPPR', '.RRR.'],
}
// Deep amber-brown, so the pads sit back and the koi stay the brightest thing in the pond.
const PAD_COLORS = { R: '#6b3a10', P: '#3d2109', V: '#52300d' }
const LOTUS = ['..A..', '.ABA.', 'ABCBA', '.ABA.', '..A..']
const LOTUS_COLORS = { A: '#ffb48a', B: '#ffd9bf', C: '#ffc233' }

type PadSpot = { x: number; y: number; size: keyof typeof PADS; lotus?: true }

// Lily pads in loose clusters of three sizes: a big one with smaller ones
// tucked beside it, in the corners and in the still water the routes leave.
// One sits at the heart of each small loop, so its koi circle it.
const PAD_SPOTS: PadSpot[] = [
  // the heart of the ring, with a lotus, and of the loop
  { x: 168, y: 76, size: 'small', lotus: true },
  { x: 79, y: 78, size: 'bud' },
  // the middle of the pond
  { x: 124, y: 70, size: 'big', lotus: true },
  { x: 137, y: 82, size: 'small' },
  { x: 118, y: 86, size: 'bud' },
  // above and below the middle
  { x: 120, y: 50, size: 'bud' },
  { x: 150, y: 106, size: 'small' },
  { x: 139, y: 112, size: 'bud' },
  { x: 60, y: 108, size: 'small', lotus: true },
  { x: 49, y: 101, size: 'bud' },
  { x: 52, y: 52, size: 'bud' },
  { x: 196, y: 50, size: 'bud' },
  // the corners
  { x: 12, y: 12, size: 'big' },
  { x: 28, y: 8, size: 'small', lotus: true },
  { x: 8, y: 28, size: 'bud' },
  { x: 228, y: 138, size: 'big', lotus: true },
  { x: 212, y: 143, size: 'small' },
  { x: 234, y: 122, size: 'bud' },
  { x: 228, y: 10, size: 'small' },
  { x: 215, y: 6, size: 'bud' },
  { x: 12, y: 140, size: 'small' },
  { x: 26, y: 145, size: 'bud' },
]

// A pad is kept only where no koi can reach it: its edge stays clear of every
// route by more than half a koi's width and the sweep of its tail.
function padsClearOfRoutes(): PadSpot[] {
  const routes = (Object.keys(ROUTES) as Route[]).map(route => trace(ROUTES[route].points).at)
  return PAD_SPOTS.filter(spot => {
    const reach = PADS[spot.size][0]!.length / 2 + KOI_WIDTH / 2 + 4
    return routes.every(points => points.every(([x, y]) => Math.hypot(x - spot.x, y - spot.y) > reach))
  })
}

function pads(): string {
  return padsClearOfRoutes()
    .map((spot, i) => {
      const rows = PADS[spot.size]
      const width = rows[0]!.length
      const lotus = spot.lotus ? `<g transform="translate(${Math.floor(width / 2) - 3} ${Math.floor(rows.length / 2) - 4})">${sprite(LOTUS, LOTUS_COLORS)}</g>` : ''
      return (
        `<g transform="translate(${Math.round(spot.x - width / 2)} ${Math.round(spot.y - rows.length / 2)})">` +
        `<g class="rock" style="animation-duration:${7 + (i % 4)}s;animation-delay:-${round(i * 1.3)}s">${sprite(rows, PAD_COLORS)}${lotus}</g></g>`
      )
    })
    .join('')
}

// The water's flow: everything on the surface drifts the same way, left to
// right, so the pond reads as a slow current the koi swim through.

// One layer of ripples, short dashes on the surface. It is drawn twice, a
// pond's width apart, and slid one width along, so the drift never ends or jumps.
function rippleLayer(seed: number, count: number, color: string, twinkle: boolean): string {
  const r = rng(seed)
  let dashes = ''
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * W)
    const y = Math.floor(r() * H)
    const w = 2 + Math.floor(r() * 5)
    const life = twinkle ? ` class="ripple" style="animation-duration:${round(4 + r() * 5)}s;animation-delay:-${round(r() * 8)}s"` : ''
    dashes += `<rect${life} x="${x}" y="${y}" width="${w}" height="1" fill="${color}"/>`
  }
  return `${dashes}<g transform="translate(${-W} 0)">${dashes}</g>`
}

// A soft band of light lying across the current, leaning with it, in stepped
// rows so it stays pixel art.
function lightBand(width: number): string {
  let d = ''
  for (let y = -2; y < H + 2; y += 2) {
    const x = Math.round(-y * 0.5)
    d += `M${x} ${y}h${width}v2h${-width}z`
  }
  return `<path fill="#ff8a2e" d="${d}"/>`
}

function water(): string {
  return (
    // the deep layer drifts slowly, the surface layer faster: that difference is the depth
    `<g class="flow deep">${rippleLayer(11, 34, '#2a1309', false)}</g>` +
    `<g class="flow">${rippleLayer(29, 22, '#3f1d0c', true)}</g>` +
    `<g class="band" opacity=".05">${lightBand(34)}</g>` +
    `<g class="band late" opacity=".035">${lightBand(18)}</g>`
  )
}

const STYLE = [
  ...(Object.keys(ROUTES) as Route[]).map(lapKeyframes),
  // The body's wave: the middle swings a little, the tail more.
  '@keyframes middle{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}',
  '@keyframes tail{from{transform:rotate(-10deg)}to{transform:rotate(10deg)}}',
  '@keyframes rock{0%,49.9%{transform:translate(0px,0px)}50%,100%{transform:translate(1px,0px)}}',
  '@keyframes ripple{0%,100%{opacity:.15}50%{opacity:1}}',
  `@keyframes flow{from{transform:translate(0px,0px)}to{transform:translate(${W}px,0px)}}`,
  `@keyframes band{from{transform:translate(-120px,0px)}to{transform:translate(${W + 120}px,0px)}}`,
  '.swim{animation-timing-function:linear;animation-iteration-count:infinite}',
  '.middle{animation:middle 1s ease-in-out infinite alternate}',
  '.tail{animation:tail 1s ease-in-out infinite alternate}',
  '.rock{animation:rock 8s linear infinite}',
  '.ripple{opacity:.3;animation:ripple 6s ease-in-out infinite}',
  '.flow{animation:flow 80s linear infinite}.flow.deep{animation-duration:140s}',
  '.band{animation:band 75s linear infinite}.band.late{animation-duration:105s;animation-delay:-48s}',
  '@media (prefers-reduced-motion: reduce){*{animation:none!important}}',
].join('')

function buildScene(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">`,
    `<style>${STYLE}</style>`,
    `<rect width="${W}" height="${H}" fill="${WATER}"/>`,
    water(),
    SCHOOL.map(koi).join(''),
    pads(),
    '</svg>',
  ].join('')
}

const SVG_SOURCE = buildScene()

// --- the mod ----------------------------------------------------------------

// The app's own colors: warm near-black surfaces, cream text, orange accent.
const { theme } = makeColors({
  label: 'Orange Kois',
  only: 'dark',
  roles: { accent: '#ff7a1a', danger: '#e5484d', success: '#8fb339', warning: '#ffc233', pro: '#ff9e64' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#140a05',
        'surface-1': '#1c0f08',
        'surface-2': '#24140b',
        'surface-3': '#2b180d',
        'text-primary': '#ffe9d2',
        'text-secondary': '#e6c3a0',
        'text-muted': '#b8957a',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE, glass: { blur: 0, tint: '#140a05', opacity: 0.3 } },
  overrideColorScheme: 'dark',
}

function apply($: EngineInterface) {
  return $.theme.set(LOOK)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'The orange kois theme: /orange-kois off | on',
    })
    // Neither a reload nor --resume keeps a theme, so set it here, unless
    // the person turned it off.
    if ((await $.store.get(CHOICE)) !== 'off') {
      const set = await apply($)
      if (!set.isDrawn) $.ui.status(`${COMMAND}: ${set.reason}`)
    }
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const wanted = e.args.trim().toLowerCase()

    if (wanted === 'off') {
      await $.store.set(CHOICE, 'off')
      await $.theme.clear()
      return { text: 'Orange kois is off and the app has its own look again. /orange-kois on brings it back.' }
    }

    if (wanted === 'on' || wanted === '') {
      await $.store.delete(CHOICE)
      const set = await apply($)
      return { text: set.isDrawn ? 'Orange kois is on.' : `Orange kois is on, but nothing here draws it: ${set.reason}` }
    }

    return { text: 'Try /orange-kois off or /orange-kois on.' }
  })

  // The scene: one drawing that moves by itself, so it is drawn once. This hook
  // hears every mod's backdrop, so it draws only its own. `isInteractive` is
  // what the official animated scenes are drawn with: the app plays a scene's
  // CSS animation there.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)

    const { Svg } = $.ui.resolve(e)

    return Svg({
      isInteractive: true,
      source: SVG_SOURCE,
      alt: 'A dark pond with orange pixel koi swimming among lily pads',
    })
  })
}
