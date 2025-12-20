# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a browser extension built with **Svelte 5** and TypeScript, using Vite with the `vite-plugin-web-extension` plugin. The extension supports both Chrome (Manifest v3) and Firefox (Manifest v2) through conditional manifest generation.

## Common Commands

### Development
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build extension for production
- `pnpm check` - Run svelte-check for TypeScript validation

### Package Management
- Uses `pnpm` as the package manager (pnpm-lock.yaml present)

## Architecture

### Extension Structure
- **Entry Points**: 
  - `src/popup.ts` - Main popup entry point that mounts the Svelte app
  - `src/background.ts` - Background script with extension lifecycle and verification logic
  - `src/content.ts` - Content script that runs on Threads pages (DOM manipulation, no framework)
- **Components**: Svelte components in `src/` directory
  - `App.svelte` - Main popup component
- **Manifest**: Dynamic manifest generation via `src/manifest.json` template with browser-specific conditionals

### Build System
- **Vite Configuration**: `vite.config.ts` uses `@sveltejs/vite-plugin-svelte` and `vite-plugin-web-extension`
- **TypeScript**: Strict TypeScript configuration extending `@tsconfig/svelte`
- **Svelte Config**: `svelte.config.js` with vitePreprocess for TypeScript support
- **Manifest Generation**: Combines `package.json` metadata with `src/manifest.json` template

### Browser Extension Features
- Cross-browser support through webextension-polyfill
- Popup interface with Svelte components
- Content script for Threads page manipulation (detects viral posts, exports articles)
- Background script for verification code handling
- Icon assets in multiple sizes (48, 72, 96, 128px)

### File Structure
```
src/
├── App.svelte             # Main popup component
├── background.ts          # Background service worker/script
├── content.ts             # Content script for Threads pages
├── popup.ts               # Popup entry point (mounts Svelte)
├── popup.html             # Popup HTML template
├── popup.css              # Global popup styles
├── manifest.json          # Extension manifest template
├── types.ts               # TypeScript type definitions
└── vite-env.d.ts          # Vite/Svelte TypeScript definitions
```

## Key Features
1. **Viral Post Detection**: Automatically detects and highlights popular posts on Threads
2. **Article Export**: Exports user's posts with engagement metrics (likes, reposts, shares)
3. **Customizable Thresholds**: Color-coded badges based on like counts
4. **Dark/Light Mode Support**: Adapts to Threads' theme automatically