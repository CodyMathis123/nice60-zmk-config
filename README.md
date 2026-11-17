# nice!60 ZMK configuration

Firmware and a **read-only, interactive keymap explorer** for the nice!60 keyboard.

## Explore the keymap

After the **Keymap viewer** GitHub Actions workflow deploys on `main`, open:

**https://codymathis123.github.io/nice60-zmk-config/**

The site shows the physical ANSI-style layout and reads the exact `config/nice60.keymap` copied from the same commit. Choose **QWERTY**, **RGB**, **GAME**, or **NAV**, or click a key with `MO`, `TO`, or `LT` to jump to its target layer. Click other keys to inspect their raw ZMK bindings and what they do. Transparent keys display the inherited base-layer binding. It is a visualization, **not a keymap editor**, and has no GitHub write access.

The viewer deploys on changes to the keymap or viewer code. Pull requests run validation and attach a `keymap-viewer-preview` artifact without publishing the changes. If GitHub Pages has never been configured for this repository, go to **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source. The workflow attempts to enable Pages automatically, but a one-time settings change may still be necessary.

## Build and download firmware

1. Open [Actions → Build ZMK firmware](https://github.com/CodyMathis123/nice60-zmk-config/actions/workflows/build.yml).
2. Choose **Run workflow** on `main`, or push a change to `config/` / `build.yaml` to trigger a build automatically.
3. After a successful run, download the **firmware** artifact ZIP from the run summary.
4. Extract `nice60-zmk.uf2` and flash it following the [nice!60 instructions](https://nicekeyboards.com/docs/nice-60/getting-started/).

The workflow also checks firmware builds on pull requests. The build target is `nice60//zmk`, matching current ZMK board naming. The manifest in `config/west.yml` follows ZMK `main`, so each new build fetches current upstream firmware. This provides the newest development code, **not** a pinned stable release; upstream updates can sometimes break builds or change behavior. A successful build is not a substitute for verifying your layout and Bluetooth functionality before relying on it.

## Files

| Path | Purpose |
| --- | --- |
| `config/nice60.keymap` | Authoritative keymap used by firmware and viewer |
| `config/west.yml` | Upstream ZMK revision |
| `build.yaml` | Board build matrix |
| `docs/` | Read-only viewer (vanilla JS, no dependencies) |
| `scripts/build-viewer.mjs` | Validates and packages the site |
| `tests/keymap-model.test.mjs` | Verifies layer parsing, key geometry, and inheritance |
| `.github/workflows/build.yml` | Firmware builds and artifacts |
| `.github/workflows/keymap-viewer.yml` | Viewer checks, preview artifact, and Pages publishing |

### Local preview

With Node.js 22+ installed:

```sh
node --test tests/keymap-model.test.mjs
node scripts/build-viewer.mjs
python -m http.server 8000 --directory _site
```

Then open http://localhost:8000. The browser fetches the packaged keymap from the site itself, not from an external keymap service.
