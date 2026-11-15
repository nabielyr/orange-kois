# orange-kois

A theme for the Code tab of the Claude desktop app: a dark pond seen from above, in pixel art, with the app recolored in warm orange on near-black.

- **Koi**: seven orange-and-white koi in four colorings. Three swim a long wavy lap around the pond, two a small loop on the left, and two circle a lotus on the right. They turn to face along their routes, and their bodies flex from head to tail.
- **Routes that never meet**: no two routes come within a koi's width of each other, and every koi on a route swims it at the same steady pace, so no koi ever meets or covers another.
- **Lily pads**: amber-brown pads in three sizes, in loose clusters in the middle and the corners, some with a lotus. A pad is only drawn where no koi can reach it.
- **Current**: two layers of ripples drift left to right at different speeds, and two faint bands of light sweep across with them.

It is made for dark mode. There are no words in the scene.

## Commands

| Command | What it does |
| --- | --- |
| `/orange-kois off` | Take the theme off and give the app its own look back (stays off in later sessions) |
| `/orange-kois on` | Put it back |

A session has one theme at a time, so run one theme mod at a time. Installing and setup are in the [repository README](../../README.md#setup).

## How it works

It follows the docs' recipe for [a backdrop behind the conversation](https://code.claude.com/docs/en/plugins/mods/interface#put-a-backdrop-behind-the-conversation). At session start it makes one `$.theme.set` call with both the app's colors (built with `makeColors`) and a backdrop scene, and a `ui.render` hook draws that scene at the `Backdrop` site.

- `hooks/register.tsx` holds everything: the scene, the colors, the command and the hook.
- The scene is one SVG on a 240 x 150 grid of big pixels, with a `viewBox` that covers any window. It is drawn as an interactive `Svg` and moved by CSS animation in its own `<style>`, with only `translate`, `rotate` and `opacity` in its keyframes, the way the scenes in Anthropic's `theme-examples` plugin are.
- Each route is a closed Catmull-Rom curve through a few points. Its lap is worked out once, as a list of places and headings at a steady pace, and written as one `@keyframes` that every koi on the route shares, each starting partway through.
- A koi is three sprites (head, middle, tail). The middle swings from the head and the tail from the middle, a little out of step, which makes the wave.
- `hooks/make-colors.js` and `make-colors.d.ts` are copied unchanged from Claude Code's plugin-authoring skill, as its guide for themes says to. Copy them again when your build updates.
- `tests/backdrop.test.ts` checks that the theme is set at session start and that the scene is drawn. Run it with `claude plugin test`.

## License

[MIT](LICENSE)
