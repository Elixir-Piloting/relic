# Building Relic Desktop App

This guide explains how to build and bundle the Electron app into an executable (.exe) file for Windows.

## Prerequisites

1. **Node.js** (v20 or later)
2. **npm** (comes with Node.js)
3. **Windows** (for building Windows executables)

## Quick Build (Recommended)

From the project root:

```bash
npm run build:desktop
```

Or from the desktop directory:

```bash
cd apps/desktop
npm run build
```

This will:
1. Build the Next.js web app with `ELECTRON_BUILD=true` (creates standalone build)
2. Compile TypeScript (`npm run compile`)
3. Package everything with electron-builder

## Step-by-Step Build

### 1. Install Dependencies

From the project root:

```bash
npm install
```

### 2. Build the Web App (with Electron flag)

```bash
cd apps/web
set ELECTRON_BUILD=true
npm run build
```

Or on PowerShell:
```powershell
cd apps/web
$env:ELECTRON_BUILD="true"
npm run build
```

### 3. Build the Electron App

```bash
cd apps/desktop
npm run compile
npm run build:electron
```

Or use the combined command:
```bash
cd apps/desktop
npm run build
```

### 4. Find Your Executable

After building, you'll find the executables in:

```
apps/desktop/release/
```

For Windows, you'll get:
- **NSIS Installer**: `Relic Setup X.X.X.exe` (installer, ~100-200MB)
- **Portable**: `Relic X.X.X.exe` (portable, no installation needed, ~100-200MB)

## Build Commands Reference

### From Root Directory

```bash
# Build everything (shared packages, web, and desktop)
npm run build

# Build only desktop app
npm run build:desktop
```

### From apps/desktop Directory

```bash
# Build Next.js app for Electron (with ELECTRON_BUILD=true)
npm run build:next

# Build Electron app (compiles TypeScript + packages with electron-builder)
npm run build:electron

# Build everything (Next.js + Electron)
npm run build
```

## Build Options

### Build for Windows Only

```bash
cd apps/desktop
npm run build:electron -- --win
```

### Build for Specific Architecture

```bash
# 64-bit (default)
npm run build:electron -- --win --x64

# 32-bit
npm run build:electron -- --win --ia32
```

### Build Portable Version Only

Edit `apps/desktop/electron-builder.config.js` and change:

```javascript
win: {
  target: ["portable"], // Only portable, no installer
  icon: "../web/public/applogo.png",
},
```

## Troubleshooting

### "Next.js build not found" Error

Make sure you've built the web app with the ELECTRON_BUILD flag:

```bash
cd apps/web
# Windows CMD
set ELECTRON_BUILD=true && npm run build

# PowerShell
$env:ELECTRON_BUILD="true"; npm run build
```

### Icon Not Showing

Ensure `apps/web/public/applogo.png` exists and is a valid PNG file.

### Build Fails with TypeScript Errors

Make sure TypeScript compiles successfully:

```bash
cd apps/desktop
npm run compile
```

### Large File Size

The standalone Next.js build includes Node.js and all dependencies. This is normal for Electron apps. The final .exe will be ~100-200MB.

### Server Not Starting in Production

If the app shows "Build Error" when running the .exe, check:
1. The Next.js build was created with `ELECTRON_BUILD=true`
2. The `.next/standalone` folder exists in `apps/web/.next/`
3. The electron-builder config includes the Next.js build files

## Development vs Production

- **Development**: Runs Next.js dev server (`npm run dev`)
- **Production**: Uses Next.js standalone build (packaged with Electron)

The build process automatically detects the environment and serves the appropriate version.
