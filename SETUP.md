# Monorepo Setup Guide

This project has been converted to a monorepo with both web and desktop (Electron) variants.

## Structure

```
relic/
├── apps/
│   ├── web/          # Next.js web application
│   └── desktop/      # Electron desktop application
├── packages/
│   └── shared/       # Shared code (database adapters, utilities)
└── package.json      # Root workspace configuration
```

## Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build shared package:**
   ```bash
   cd packages/shared
   npm run build
   cd ../..
   ```

## Development

### Web App
```bash
npm run dev:web
```
Runs the Next.js app at `http://localhost:3000`

### Desktop App
```bash
npm run dev:desktop
```
This will:
1. Start the Next.js dev server
2. Wait for it to be ready
3. Launch the Electron app

## Building

### Build All
```bash
npm run build
```

### Build Individual Apps
```bash
npm run build:web      # Build web app only
npm run build:desktop  # Build desktop app only
```

## Migration Notes

### Import Paths

The web app still uses the original import paths (`@/lib/...`). To use the shared package, you can:

1. **Keep current structure** - The web app has its own copy of lib files
2. **Migrate to shared** - Update imports to use `@relic/shared`

Example migration:
```typescript
// Before
import { connect } from "@/lib/db/connection";

// After
import { connect } from "@relic/shared";
```

### Database Connections

Both apps share the same database connection logic through the shared package. The Electron app can use the same API routes or implement direct database access.

## Next Steps

1. **Update imports** - Gradually migrate web app to use `@relic/shared`
2. **Production build** - Configure Next.js standalone output for Electron
3. **Packaging** - Test electron-builder configuration for all platforms
4. **Shared UI** - Consider extracting UI components to a shared package

## Troubleshooting

### Module not found errors
- Ensure `packages/shared` is built: `cd packages/shared && npm run build`
- Run `npm install` from the root to link workspaces

### Electron won't start
- Make sure Next.js dev server is running first
- Check that port 3000 is available
- Verify `wait-on` package is installed

### Type errors
- Rebuild shared package: `cd packages/shared && npm run build`
- Restart TypeScript server in your IDE
