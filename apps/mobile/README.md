# @food-app/mobile

Expo (React Native) + TypeScript. M0 scope: navigation skeleton with the four
top-level tabs (Σήμερα, Assistant, Παραγγελίες, Προφίλ), each rendering a
placeholder screen tagged with the milestone that fills it in for real.

## Run

```bash
pnpm install
pnpm --filter @food-app/mobile start
```

Requires the Expo Go app (or a simulator) — this sandbox can type-check the
code but can't launch a phone/simulator, so treat `typecheck` as the
verification step here and a real device/simulator run as the next check
once you have the repo locally.

```bash
pnpm --filter @food-app/mobile typecheck
```
