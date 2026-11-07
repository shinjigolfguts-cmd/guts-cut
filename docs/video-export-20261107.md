# Video start, join pacing, and offline export — 2026-11-07

Changes:
- A single-video import and compatibility recorder now wait for decoded picture rather than metadata. Recorders start/resume only after painting a decoded frame, and explicitly request canvas capture frames when supported.
- Removed the second-clip play/warm/rewind cycle.
- Lossless MP4 joining now uses one continuous video edit even when input timescales are equal. Changed video decoder descriptions and non-contiguous/empty video edits use the conversion path rather than triggering mid-file decoder reconfiguration/seeks.
- Added a pinned, locally served Mediabunny 1.65.2 module (MPL-2.0) for offline WebCodecs export. Single edits preserve frame timestamps and timed layers, trim precisely, and copy audio where possible. Mixed clips decode independently into one encoder; each clip starts with a keyframe. Mono/stereo audio is normalized and silent clips retain their timeline interval.
- Encoded output uses Blob chunks with a seekable stream target and ordinary MP4 priming edits. No large contiguous output buffer or fragmented-MP4 decode-delay offset is required.
- Recovery writes run independently of save readiness. Writes are serialized and newer jobs cancel older backups, so a completed output cannot be overwritten by an input backup.

Verification:
- `node tests/video-regression.mjs` uses FFmpeg-generated H.264/AAC fixtures and compares every decoded frame hash. Two 2-second inputs produce 120 identical frames at continuous 30fps timestamps, starting at exactly 0. Changed decoder parameters are rejected. Metadata-only readiness and abort behavior are covered.
- Exercised the exact offline engine source with Mediabunny 1.65.2 native server codecs and a test-only Node canvas/raw-plane bridge, since the managed browser tool is unavailable. Verified trimming, actual editor draw/timed rectangles, gain=0.5, differing video encodings, a silent middle clip, mixed portrait/landscape and 30/60fps inputs, and pre-abort.
- ffprobe/FFmpeg verification: 1-second trimmed/edited outputs contain 30 frames starting at 0; mixed 6-second output contains 180 frames starting at 0, with keyframes at 0/2/4 seconds and no decode errors. Portrait combination preserves all 120 input frames over 3 seconds. Timed-overlay pixels and audio gain/silence checked after decoding.
- fake-indexeddb verified superseding a running input backup with finished output and restoring it. A stalled recovery write does not block delivery of the completed video.
- JavaScript syntax, script/module asset references, and Git whitespace checks.

Limits:
- Browser/WebCodecs implementations and iPhone Safari/ChatGPT web view were not exercised. Native codec test timings are not device performance claims.
- Offline export requires supported browser codecs. Changed playback speed, unsupported codecs, differing audio sample rates in a mixed batch, or multichannel audio fall back to the compatibility recorder. That path still takes approximately playback time.
- A user's original videos and a long 4K/HEVC batch were unavailable. No fixed speed multiplier or instant export guarantee is established.
