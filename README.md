# Relic - Database Admin

A modern, fast database administration client for PostgreSQL, MySQL, MongoDB, SQLite, and more.

## Monorepo Structure

This is a monorepo containing:

- **`apps/web`** - Next.js web application
- **`apps/desktop`** - Electron desktop application
- **`packages/shared`** - Shared code (database adapters, utilities, types)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

#### Web App
```bash
npm run dev:web
```

#### Desktop App
```bash
npm run dev:desktop
```

This will start the Next.js dev server and launch the Electron app.

### Building

#### Build All
```bash
npm run build
```

#### Build Web Only
```bash
npm run build:web
```

#### Build Desktop Only
```bash
npm run build:desktop
```

## Features

- Multi-database support (PostgreSQL, MySQL, MongoDB, SQLite, LibSQL/Turso, Supabase, PlanetScale)
- Schema explorer with visual relationships
- SQL query editor with syntax highlighting
- Safe Mode for destructive queries
- Visual query plans (EXPLAIN ANALYZE)
- Saved queries with version history
- Full CRUD operations
- Table structure editing
- Dark mode UI

## Tech Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Electron** - Desktop app
- **Monaco Editor** - Code editor
- **Zod** - Schema validation

## License

Private
