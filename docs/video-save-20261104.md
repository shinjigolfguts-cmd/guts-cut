# Video export and five-minute delivery

- Restored edited-video export: removed the unconditional originalFile rejection.
- Export canvas now follows the source width and selected aspect ratio, with even dimensions, instead of the 720px preview. Recompression is still lossy.
- Export paints on decoded-video callbacks where supported; removed duplicate preview/export rendering. Preview avoids drawing identical currentTime values.
- Mixed-format render supports bounded ranges, AbortSignal cancellation and load/stall timeouts. Multi-selection locks the editor and allows cancellation.
- Five-minute delivery prompts for split, keep whole, or cancel. Parts target at most 298 seconds (margin for live recorder timing), are generated sequentially, measured before saving, and use numbered filenames. More than two parts may be required. Originals are unchanged. Split is explicitly labeled as recompression.
- Edited exports expose a fresh save button after processing so browser user-activation expiry does not discard a finished export. Share cancellation retains the output for retry.

Validation in cloud Chromium: actual H.264/AAC 30fps synthetic 3-second source rendered from 1s to 2s; result metadata 0.921 seconds. This is a real-time recorder, NOT frame-exact splitting. Pre-aborted render rejected with AbortError. Range coverage checked at 300, 300.001, 599, 600, 1200, 9000 seconds. Split dialog verified with mocked 301-second metadata, including keep-whole result. Actual editor trim 1–2 seconds reached save-ready and download-complete UI. JavaScript syntax and git whitespace checks passed.

Not verified: iPhone Safari, LINE sending, 5-minute real export, 20–50 large files, output frame pacing/audio synchronization under mobile load. Native InShot-equivalent speed is not established. Real-time MediaRecorder processing remains approximately playback duration and can drop frames under load. No lossless/instant export guarantee is made. Existing GitHub sync is unchanged.
