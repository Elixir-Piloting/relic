# AGENTS.md

## Commands

```bash
# Install and build shared package (required first step)
pnpm install && pnpm run build:shared

# Development
pnpm run dev:web          # Next.js at localhost:3000
pnpm run dev:desktop     # Electron + Next.js dev server

# Build (always runs build:shared first)
pnpm run build:web       # Next.js standalone build
pnpm run build:desktop   # Electron app → apps/desktop/release/
pnpm run build           # Everything
```

## Important Notes

- **Shared package must be built first** before apps can import from `@relic/shared`. Always run `pnpm run build:shared` after fresh installs.
- **Desktop app build**: Requires `ELECTRON_BUILD=true` when building Next.js (`pnpm run build:web` handles this automatically).
- **Web app has duplicate lib files**: `apps/web/lib/` coexists with `packages/shared` - both are used. The shared package exports need updating to match web app's lib code.
- **No test framework configured**: No test scripts exist.

## Structure

- `apps/web` - Next.js 16 app (pages, components, API routes)
- `apps/desktop` - Electron app (main.ts, preload.ts)
- `packages/shared` - Database adapters (PostgreSQL, MySQL, MongoDB, SQLite)

## Tech Stack

- Next.js 16, React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui (Radix), Monaco Editor
- Electron 30, Zod 4
- pnpm (package manager)
