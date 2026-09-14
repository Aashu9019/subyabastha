# Subyabastha

A Windows desktop app that keeps your folders organized automatically. Set up rules once, and Subyabastha sorts, moves, and tidies files as they arrive.

## Download

**[Download Subyabastha for Windows](https://github.com/Aashu9019/subyabastha/releases/latest/download/Subyabastha-Setup.exe)**

Or browse all versions on the [Releases page](https://github.com/Aashu9019/subyabastha/releases).

Run `Subyabastha-Setup.exe` and follow the installer. If Windows SmartScreen shows a warning, click **More info**, then **Run anyway**. The installer is not code-signed yet.

## Features

- **Folder watching:** monitors the folders you choose and applies your rules to new files automatically.
- **Rule builder:** match files by name, extension, or text inside PDFs, then move, copy, rename, or delete them.
- **Presets:** start from ready-made rules, such as sorting PDFs out of your Downloads folder or filing invoices.
- **Dry run:** preview what a rule would do before any file is touched.
- **Undo center:** every action is logged, so you can reverse moves, renames, and copies.
- **Safe deletes:** deleted files go to the Recycle Bin, so you can restore them from there.
- **Runs in the tray:** keeps working quietly in the background.

## Build from source

Requires Node.js 18 or later.

```bash
git clone https://github.com/Aashu9019/subyabastha.git
cd subyabastha
npm ci
npm run dev
```

To build the Windows installer yourself, run `npm run dist`. The installer is written to `dist-installer/`.

## Contributing

Bug reports and pull requests are welcome. Please [open an issue](https://github.com/Aashu9019/subyabastha/issues) to describe a bug or discuss a change before starting larger work.

## Author

Made by Aashutosh.
