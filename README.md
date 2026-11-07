# fetaUI Free

Animated icons and UI components for React, built with Motion. This repository holds the Free tier:
the Interface Essential icons in 10 styles, the icon runtime, and the Free UI components.

Docs and the full catalog: https://fetaui.dev

## Packages

- `packages/react`: `@fetaui/react`, animated icon components and the shared runtime.
- `components`: the Free UI components, styled with CSS modules on `--feta-*` tokens.
- `svg`: static SVGs for every Free icon, one folder per style.

## Develop

```
pnpm install
pnpm build
pnpm test
```

This repository is a published mirror of the Free tier and is replaced on every release, so pull
requests here cannot be merged. Please open an issue instead: fixes are made upstream and arrive
with the next sync.

## License

MIT for fetaUI's own code (see LICENSE). The icon shapes derive from an MIT licensed source set; its
notice is in LICENSES/THIRD-PARTY-NOTICES.txt.
