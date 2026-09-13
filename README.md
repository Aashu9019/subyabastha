# Subyabastha

An Electron + Vite desktop app for file management and PDF processing.

**Quick links**
- Live downloads / releases: https://github.com/Aashu9019/subyabastha/releases

**Note about a downloadable EXE:** You can publish installers or portable EXEs using GitHub Releases. Once you upload a built Windows artifact to Releases, link the direct download (example pattern: https://github.com/Aashu9019/subyabastha/releases/latest/download/Subyabastha-Setup.exe).

**Table of Contents**
- Features
- Getting Started
- Development
- Building & Packaging
- Troubleshooting
- Contributing
- License

## Features
- Electron + Vite + React + TypeScript
- PDF parsing and file operations
- Fast UI using Tailwind + Framer Motion

## Getting Started
Prerequisites
- Node.js 18+ and npm installed

Clone the repository:

```bash
git clone https://github.com/Aashu9019/subyabastha.git
cd subyabastha
```

Install dependencies:

```bash
npm ci
```

## Development
- Start the app in development mode (runs Vite + Electron):

```bash
npm run dev
```

This uses the project scripts to run the renderer dev server and launch Electron once the UI is ready.

## Building & Packaging
You can build the UI and the Electron main process, then create a Windows package using electron-builder.

- Build the UI and electron sources:

```bash
npm run build
```

- Build a Windows distributable (installer/EXE):

```bash
npm run dist
```

After `npm run dist` completes, inspect the `dist/` folder (or the platform-specific output printed by electron-builder) for built artifacts.

To publish a downloadable EXE for others:
- Run `npm run dist` on a Windows machine or CI configured for Windows builds.
- Upload the generated installer/EXE to GitHub Releases for the repository.
- Use the Releases download URL (example pattern above) in your repo README or site so users can download the exe directly.

## Troubleshooting
- If the app doesn't start in dev mode, ensure no other process is using port 5173 and that `npm ci` completed without errors.
- If packaging fails, inspect the electron-builder output and ensure correct signing/codesigning configuration (not required for local testing).

## Contributing
- Fork the repo, create a feature branch, and open a pull request. Keep changes small and include tests where appropriate.

## License
This repository does not include a license file. Add a `LICENSE` if you want to clarify reuse rules.

---

If you'd like, I can:
- Add a GitHub Releases checklist or a GitHub Actions workflow to build and publish Windows artifacts automatically.
- Draft a sample release with a placeholder EXE link you can replace after uploading.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
