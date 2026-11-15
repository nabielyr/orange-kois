import { expect, test } from 'claude-code/testing'

const BACKDROP = {
  plugin: 'orange-kois',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: {
    scene: 'orange-kois',
    plugin: 'orange-kois',
    glass: { blur: 10, tint: '#1a0b05', opacity: 0.6 },
  },
} as const

test('the session starts with the orange-kois backdrop set', async ($, on) => {
  const sets: unknown[] = []
  on('command.register', () => ({ value: { command: 'orange-kois' } }))
  on('store.get', () => ({ value: undefined }))
  on('theme.set', (_, e) => {
    sets.push(e)
    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(sets.length).toBe(1)
  expect(JSON.stringify(sets[0])).toContain('"scene":"orange-kois"')
})

test('the desktop draws an animated pixel svg that fits the limit', async $ => {
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  const source = String((svg as { props?: { source?: string } } | undefined)?.props?.source ?? '')
  expect(source.startsWith('<svg')).toBe(true)
  expect(source.includes('@keyframes')).toBe(true)
  expect(source.length < 131072).toBe(true)
  await ui.unmount()
})

test('another backdrop is left to the engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: ['engine'] })
  })
  const ui = await $.ui.mount({
    ...BACKDROP,
    props: { ...BACKDROP.props, scene: 'other' },
    surface: 'desktop',
  })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})
