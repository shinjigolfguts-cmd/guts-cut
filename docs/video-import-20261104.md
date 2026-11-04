# Video import recovery — 2026-11-04

Observed source problems: single-video errors were caught and only toasted, leaving the empty editor; metadata had no timeout/load call; startup eagerly deserialized the complete prior recovery job; batch persistence cloned all input files in one transaction; replaced batch download URLs and decoder resources were retained.

Changes: persistent picker/loading/error UI with same-file retry; single import guard; explicit metadata load and 30-second deadline; MOV with missing MIME accepted by extension; recovery metadata read separately and video data loaded only on restore; individual-file IndexedDB transactions with deadlines and cancellation; old batch URL and media decoder cleanup. No source video bytes or encoding settings changed. Existing GitHub synchronization unchanged.

Browser QA (remote Chromium, synthetic fixtures):
- Invalid MOV: persistent error and retry, no empty editor; retry retains selection.
- Invalid then valid single MOV: editor opens, Save enabled.
- 50 x 1-second 320x240 H.264 MOV: ready, download successful; ffprobe confirms 50 seconds / 1500 frames; ffmpeg decodes complete file without errors.
- Reload after completed join: output restored without conversion.
- Invalid MOV + valid MOV: batch error retains both names and retry button.
- Portrait 15-second MOV + landscape MOV: cancel during conversion retains both inputs; reload and restore retains both inputs and offers resume.
- JavaScript syntax checks passed.

Limits: user's iPhone/WKWebView and original clips not available for reproduction. OS process termination, iCloud transfer before input change, long 4K/HEVC sets, Photos save and storage quota exhaustion are not verified by these small Chromium fixtures. Do not claim these are fixed or benchmark against InShot.
