# WebCompress — standalone build

This branch contains the generated, self-contained WebCompress app.

Open **`index.html`** directly in a modern browser. No server, install step, or network connection is required. The UI, fonts, worker, and 7-Zip WebAssembly engine are all embedded in that one file.

- Source code and development instructions live on the **`wasm`** branch.
- Do not edit this branch by hand. Run `npm run build` on `wasm` and copy the resulting `dist/index.html` here.
- Built from `wasm` commit `250f42d`.
