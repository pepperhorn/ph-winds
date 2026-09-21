# ph-winds

A single-page builder for wind-instrument fingering cards. Pick an instrument,
select a note on a virtual piano (in written or concert pitch), choose a
fingering, and add a card showing the fingering diagram, the written note on
a staff, or both. Cards collect on a board that exports to PNG, PDF and JSON,
and can play back the written note as instrument voice or piano at sounding
pitch.

![A ph-winds board titled "Alto Sax — First Notes", showing three alto
saxophone fingering cards labelled Middle G, Middle B♭ / A♯ and High G — each
with its concert pitch, a fingering diagram and the written note on a staff —
alongside a text card reading "Long Tones".](docs/board-screenshot.png)

## Stack

- [Astro 7](https://astro.build) (static output) with a single React 19 island
- Tailwind CSS v4, Poppins (`@fontsource/poppins`)
- [Verovio](https://www.verovio.org/) for staff notation (Bravura and
  Petaluma engraving fonts)
- [`@pepperhorn/fingering-components`](https://github.com/pepperhorn/fingering-components)
  for fingering diagrams and instrument/fingering data
- [smplr](https://github.com/danigb/smplr) for sampled playback
- `html-to-image` + `jsPDF` for PNG/PDF export
- Vitest + Testing Library for unit tests, Playwright for e2e

## Development

```bash
pnpm install
pnpm dev        # astro dev --host 0.0.0.0, so it's reachable from other devices on the network
```

Fingering data and diagrams come from
[`@pepperhorn/fingering-components`](https://www.npmjs.com/package/@pepperhorn/fingering-components)
on npm, so `pnpm install` is all you need. To work against a local checkout of
that library instead, point the dependency at it with
`pnpm add @pepperhorn/fingering-components@link:../fingering-components`.

### Checks

```bash
pnpm verify     # astro check + vitest run
pnpm e2e        # playwright test (builds, serves on :4329, and runs the smoke test)
pnpm build      # production build to dist/
```

## Deployment

Deployed via [Coolify](https://coolify.io) using `nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["nodejs_22", "pnpm"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm build"]

[start]
cmd = "npx serve@14 dist -l 3000"
```

`public/healthz` is a static file served at `/healthz` for Coolify's health
check.

## Credits

| | |
|---|---|
| Fingering diagrams | `@pepperhorn/fingering-components` (MIT) |
| Notation | Verovio (LGPL-3.0); Bravura and Petaluma by Steinberg (SIL OFL 1.1) |
| Sounds | FluidR3_GM by Frank Wen (MIT), via gleitz/midi-js-soundfonts (CC BY 3.0) |
| Recorder samples | Versilian Community Sample Library by Sam Gossner (CC0) |
| Playback | smplr by danigb (MIT) |

## License

MIT
