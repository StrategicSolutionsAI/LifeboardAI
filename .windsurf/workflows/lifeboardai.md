---
description: Routine
---

# /lifeboard-daily-build
One-click routine to keep the dashboard stable.

1. Pull latest `dev`.
2. Run `pnpm lint && pnpm typecheck`.
3. Run `pnpm vitest run --coverage`.
4. If coverage < 80 %, ask the user whether to proceed.
5. Build storybook: `pnpm storybook:build`.
6. Deploy preview to Netlify CLI (`netlify deploy --build`).
7. Summarise results and copy preview URL to clipboard.