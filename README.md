# WebCompress

A private, browser-only archive studio. Build password-protected ZIP and 7Z archives, hide file names with 7Z encrypted headers, and inspect or extract existing archives — all without uploading a byte.

![WebCompress](https://img.shields.io/badge/privacy-100%25%20local-c9f158) ![React](https://img.shields.io/badge/React-19-181a16) ![Vite](https://img.shields.io/badge/Vite-8-181a16)

## Features

- **ZIP creation** with AES-256 password protection via [`@zip.js/zip.js`](https://github.com/gildas-lormeau/zip.js).
- **7Z creation** with LZMA2 compression and optional `-mhe=on` encrypted headers via [`7z-wasm`](https://github.com/nickrussler/7z-wasm).
- **Encrypted file names** — turning this on automatically switches to 7Z, since standard ZIP keeps names visible.
- **Compression levels** — Store, Fast, Balanced, and Maximum, mapped to each format's native levels.
- **File and folder input** — pick files, pick a folder, or drag files and whole directory trees onto the page.
- **Archive extraction** — inspect and extract ZIP, 7Z, RAR (v4/v5), TAR, GZ, BZ2, and XZ, including nested `.tar.gz` / `.tgz` / `.tar.bz2` / `.tar.xz` archives.
- **Preview before extracting** — browse the file list, download individual files, or save everything as one ZIP bundle.
- **Password handling** — header-encrypted archives show a locked state; wrong passwords are reported without leaking names.
- **Responsive UI** — designed for desktop, tablet, and mobile, with keyboard-accessible controls and reduced-motion support.

## Privacy

Everything runs in the tab. File contents, names, and passwords never leave the browser. ZIP encryption uses Web Crypto through `zip.js`; 7Z runs as WebAssembly in a dedicated worker. There is no backend, account, analytics, or upload limit.

## Standalone build — no server required

```bash
npm install
npm run build
```

The build writes one self-contained file: `dist/index.html`. Open it directly in a modern browser — including via `file://` — with no dev server, preview server, install step, or network connection. The React UI, fonts, worker, and 7-Zip WebAssembly engine are all embedded in that single file (about 5 MB). You can copy it anywhere and keep using it offline.

The interface is React/JavaScript; archive work runs locally in the browser. ZIP encryption uses Web Crypto, and 7Z/RAR/TAR extraction uses the embedded 7-Zip WebAssembly engine. Tested from `file://` in Chromium.

### Development

```bash
npm run dev
```

Open the printed local URL. `npm run preview` is optional if you want to test the production build over HTTP.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build the standalone `dist/index.html` |
| `npm run preview` | Serve the production build over HTTP (optional) |
| `npm run lint` | Run Oxlint |

## How it works

- `src/lib/zip.ts` creates, inspects, and extracts ZIP archives with `zip.js`.
- `src/lib/sevenzip.worker.ts` runs the 7-Zip WASM engine for 7Z, RAR, TAR, and compressed single-file formats. It also unwraps the outer layer of `.tar.gz`-style archives before listing or extracting.
- `src/lib/sevenzip.ts` owns the worker lifecycle and queues requests so the WASM module is only initialized once.
- `src/lib/files.ts` handles file/folder collection, path normalization, deduplication, and downloads.
- `src/components/ExtractWorkspace.tsx` implements the read-only archive explorer.
- `vite.config.ts` uses `vite-plugin-singlefile`; the worker is imported with `?worker&inline`, and the fonts and WASM binary are embedded as data URLs so the production build is one portable HTML file.

## Notes and limitations

- **ZIP file names stay visible.** ZIP protects file contents, not the names. Use 7Z with encrypted headers when names are sensitive.
- **RAR is read-only.** The Extract tab can open and unpack RAR archives; it cannot create them.
- **Memory is bounded by the tab.** Very large archives are processed in memory, so available browser memory is the practical limit.
- **7Z headers are all-or-nothing.** Header encryption hides every name in the archive until the correct password is entered.
- macOS `unzip` may refuse AES-256 ZIPs with `need PK compat. v5.1`; that is a limitation of the tool, not the archive. 7-Zip, WinRAR, Keka, and WebCompress can open them.
