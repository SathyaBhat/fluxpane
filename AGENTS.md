# Repository Guidelines

## Project Structure & Module Organization

FluxPane is a Tauri v1 desktop RSS reader. The React/TypeScript frontend is in
`src/`: shared UI lives in `components/`, reusable logic in `hooks/`, Miniflux
and favicon integrations in `services/`, domain types in `types/`, and theme
definitions in `themes/`. `src/App.tsx` owns application state and coordinates
the sidebar, article list, and article view. The Rust desktop wrapper and
system-tray code are in `src-tauri/`. Static assets belong in `public/`;
generated output belongs in `dist/` and should not be edited manually.

## Build, Test, and Development Commands

Run these from the repository root:

```bash
npm install             # Install JavaScript dependencies
npm run dev             # Start the Vite browser development server
npm run tauri dev       # Run the full desktop app in development mode
npx tsc --noEmit        # Type-check the frontend without emitting files
npm run build           # Type-check and create the Vite production build
npm run tauri build     # Build the packaged Tauri application
```

Rust changes can be checked from `src-tauri/` with `cargo check`. There is
currently no automated test suite or lint script.

## Coding Style & Naming Conventions

Use strict TypeScript settings, two-space indentation, semicolons only when
needed by the surrounding code, and single-quoted strings. Use `PascalCase`
for React components and component files, `camelCase` for functions and
variables, and descriptive lowercase names for service modules. Prefer the
existing component and hook patterns over introducing new state-management
layers. Keep theme colors in `src/themes/catppuccin.ts` and consume them as
CSS variables in `src/styles.css`.

## Testing Guidelines

Before submitting changes, run `npx tsc --noEmit` and, when relevant, test
the desktop flow with `npm run tauri dev`. Manually verify Miniflux login,
feed/category navigation, article status changes, settings persistence, and
system-tray behavior for affected areas.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries such as `Add ...`, `Fix ...`,
and `Rename ...`. Follow that format and keep each commit focused. Pull
requests should explain the user-visible change, list validation commands,
note any Miniflux or Tauri configuration impact, and include screenshots or
short recordings for UI changes. Do not commit secrets, API keys, or generated
build artifacts.

## Security & Configuration

The app stores the Miniflux server URL and API key in browser `localStorage`.
Treat local configuration and logs as sensitive, and use test credentials
when debugging. Keep API calls inside `src/services/miniflux.ts` unless a
feature specifically requires another integration.

## Release Process

Keep the version synchronized in `package.json`, `package-lock.json`,
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.
Update `CHANGELOG.md`, then create a matching tag such as `v1.1.0`. GitHub
Actions runs CI on pushes and pull requests; a matching version tag builds the
Windows installers and creates a draft GitHub Release.
