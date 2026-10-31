# Reference fidelity status — third pass
Reference: IMG_5690.jpeg, IMG_3123.mp4, IMG_3125(1).mp4, ScreenRecording_10-31-2026 16-53-01_1.mp4.
User explicitly requires identical UI and content. Full parity is NOT complete.
Home uses the supplied screenshot as an unchanged visual asset with accessible interactive overlays for video/photo/collage/settings. Promotional content is visual only; click accurately reports unimplemented. No captured personal photo library is included.
Photo editor toolbar verified from new screen recording: キャンバス / フィルター / 調整 / エフェクト / ポートレート / ステッカー / テキスト / PIP. Replaced Unicode main icons with SVGs drawn against reference. Left undo/redo overlay; right compare/full preview; lower multiple-edit placement; panel modes hide header as recorded.
Shape grid: circle, square, rectangle, triangle, cross, 12-point seal, star, diamond, pentagon, crescent, rounded rectangle, quadrant, with reference palette.
Implemented: shape manipulation handles; text input order/outline/colors/font choices; pinch scaling/rotation; photo drag/pinch with blur background; adjustment sliders; exported image result preview and browser-native sharing.
Validation: JavaScript syntax pass. Browser used synthetic SVG fixture through actual file handler; verified toolbar, text entry, 4-column shapes, rectangle resize and drag, PNG download and saved screen. Opened exported PNG to verify rectangle and outlined text. Temporary QA files removed before publish.
Remaining mismatches: full sticker assets/category icons, unknown filter/effect/font lists, portrait/PIP/multiple edit, draft library, OS media picker/keyboard, ads/social service buttons, exact iPhone Safari viewport and video export behavior. Native picker/keyboard cannot be fixed by site CSS. Do not label as an exact full copy.

## Fourth pass: collage reference (17:22 screen recording)
Observed toolbar: ギャラリー / レイアウト / ボーダー / キャンバス / テキスト / ステッカー / フィルター / 調整.
Implemented matching order and reference geometry; gallery selection with preview and up to 20 imported images; collage layout chooser; multiline text via textarea; draggable text width handles that wrap; text style tabs for text/border/shadow/background/label/opacity. Browser-native photo chooser remains required to import photos. Gallery is not unrestricted access to the phone photo library.
Validation: synthetic two-image import using actual file event handler; horizontal collage; multiline text entry; red text color; narrowing text width demonstrated wrapping; PNG downloaded successfully. Temporary fixtures removed before packaging. Full original-app parity remains incomplete; all unseen categories/effects and iPhone export testing remain outstanding.

## Home distortion repair
User screenshot IMG_5706.jpeg showed squashed home UI inside the in-app browser. Cause: full reference screenshot rendered with width/height 100% and object-fit:fill. Removed full-screen screenshot and invisible hotspots. Home now consists of semantic heading/settings/action buttons, CSS gradients, SVG icons, and aspect-ratio:1 circles. Only promotional tile illustrations retain proportional CSS crops from the supplied reference. Browser-owned top/bottom chrome is outside site control.

## Video timeline pass — 2026-10-31
Reference: ScreenRecording_10-31-2026 17-36-20_1.mp4 (112 seconds). Added fixed center playhead, real decoded filmstrip, time ruler, green text / yellow shape tracks, draggable start/end handles and move, numeric timing fields, full-clip duration, delete and reopen editing. New text/shapes begin at playhead for up to 3 seconds. Canvas preview and export share time visibility; invisible overlays cannot be selected from canvas. Export explicitly redraws/requestFrame on its recording interval to avoid RAF throttling.
QA: six-second synthetic portrait video with audio imported through actual file handler in disposable local fixture. Six filmstrip thumbnails generated. Shape end handle drag moved from 2.0 to 3.0 seconds. Native number input updated start to 1.1. Final export test with overlay [1,3) produced VP9+Opus, 405x720, duration 6.003267, 209 decoded video frames. Pixel samples at 0 and .5 seconds background, 1 through 2.5 overlay, 3 through 5.5 background. Temporary QA assets removed before publication. iPhone Safari not tested.
Remaining: full toolbar/menu parity, animation/sticker catalog downloads, multiple video clips, music, native export options (1080p/MOV/HDR), persistent drafts. Current export remains 720px maximum and browser-supported format. Not a complete InShot reproduction.

## Collage import performance
Decode two photos concurrently (bounded concurrency 2), progressively render completed decodes, cache 1440px display canvases while retaining originals, replace synchronous PNG/base64 preview conversion with direct canvas copy, use decoded canvas thumbnails instead of loading original URLs again, skip hidden collage thumbnail strip. Preserve photo order and release stale imports after reset. Added loading count and Performance measurement. Browser QA with two 4032x3024 JPEGs (11,838,570 bytes each) measured 1042ms from file-handler start to picker ready, excluding OS picker and fixture download. Both thumbnails and selection toggling verified. No iPhone/HEIC/iCloud timing measurements; those may dominate device-side wait.

## Skip post-import collage confirmation
User requested removal of the post-selection gallery screen. Successful collage imports now go directly to the editor, including imports added through the gallery. The gallery remains available only when explicitly opened to manage existing photos. OS photo selection is unchanged.

## Collage first-display latency follow-up
User still reports excessive real-device latency. Removed explicit decode wait and pre-display 1440px buffer generation: image load triggers direct canvas display; smaller reusable buffers are scheduled after rendering. Close panels at import start; do not wait for a zero-delay timer after final batch. Versioned asset references to avoid reusing stale script URLs. Browser QA: two 4032x3024 noise JPEGs (~12MB each), 233ms import completion, 2 media items, editor visible and picker hidden. This is a single desktop-browser measurement, not iPhone/HEIC/iCloud or OS picker latency, and not zero-latency evidence.

## Independent collage photo dragging
One pointer selects the touched photo cell (using the same layout/gap geometry as rendering) and translates only that media item's offsets. Gesture target stays locked across cell boundaries. Deltas are normalized to cell dimensions for 1:1 finger movement. Pinch uses the first touched photo instead of always media[0]. Existing text/shape handles retain priority. Browser QA: left drag +40/+50 screen pixels altered only left offsets (.153846,.096154); right drag -30/-40 altered only right (-.115385,-.076923). Undo restored only the right gesture; left offsets remained. Syntax check passed. Touch hardware/pinch not exercised in this desktop QA.

## Rectangle default size
User requested twice the initial rectangle size. Changed new rectangle width/height from 160x80 to 320x160 canvas pixels, keeping its 2:1 aspect ratio and centered insertion. Other shapes and palette thumbnail sizes unchanged. Syntax check passed.

## Selected overlay gesture lock
When a visible text/shape layer is selected, pointer-down outside its bounds retains selection and cannot begin photo translation. Pinch captures the selected layer index at gesture start and cannot fall back to media zoom. Existing handles and inside-layer drag still operate. A check control is available when no editing panel is open to explicitly deselect and resume photo manipulation. Regression test used actual pointer handlers with synthetic pointer events: outside one-finger drag preserves selection, two-finger expansion resizes the cross only, both photos unchanged, deselection restores right-photo drag independently. Syntax check passed; iPhone hardware not available.

## Drag selected overlays from anywhere in preview
Selected visible text/shape now starts relative movement from any pointer location in the canvas preview, including photo backgrounds and letterbox margins; handles retain their resize/edit/delete priority. The initial finger offset is retained so the overlay does not jump to the finger. Background lock and gesture-bound pinch targeting remain in place. Actual pointer-handler regression test confirms an outside drag delta (.05,.10) changes the cross from (.5,.5) to (.55,.6), both photos remain unchanged, pinch still targets the layer, and deselection restores photo movement.

## v14 — functional undo/redo
- Transaction history records actual changes, skips no-op taps, groups drag/pinch and continuous text/slider edits. Redo is preserved until a real new edit occurs.
- Added missing history tracking for existing text, shape dimensions/colors and text opacity. Restoring closes stale editing panels and clears selection safely.
- Undo/redo use bold SVG arrows, Japanese labels, 60×46px buttons and disabled states. History retains 100 operations for this editing session.
- Validation: syntax check; VM regression for photo transforms, gesture grouping, text batching, deletion, redo and branching; browser button clicks confirmed removal/restoration of a text layer and disabled states. No physical iPhone test.

## v15 — stable overlay rotation and alignment
- Pinch scaling ignores twists up to 12 degrees; deliberate rotation responds at 65% speed. Rotation uses canvas pixel proportions.
- Cardinal angles snap within 5 degrees and remain locked until 10 degrees away, avoiding jitter. Selected aligned overlays show cyan dashed edge guides and a horizontal/vertical label; guides are excluded while exporting.
- On snap entry, a brief quiet Web Audio click and optional vibration signal alignment. Actual sound/vibration depends on browser/device support and settings; physical iPhone feedback unverified.
- Validation: syntax, rotation dead-zone/damping/hysteresis tests, existing history and independent-photo gesture regression checks; browser verified rectangle alignment guides.

## v16 — bottom guide only, unrestricted overlay position
- Alignment guide now draws only the bottom edge, with no angle label.
- Removed x/y clamping for overlay dragging. Selected shapes/text can move beyond every canvas edge and can be brought back by dragging anywhere on the preview while still selected. Export remains clipped to the canvas.
- Validation: syntax; independent-photo gesture, offscreen/repeated overlay drag, bottom-only guide/no export guide, rotation assistance and undo/redo regression checks passed.

## v17 — text-entry tab layout
- Text editor follows visualViewport height/offset and reserves 64px at its bottom for the embedding host composer. Host UI itself cannot be hidden by this site.
- Input field and tool row restyled to the supplied reference; keyboard uses SVG, active tabs use explicit highlight, and keyboard tab restores focus without requested scrolling. Preview-only text mode hides undo/playback/navigation clutter.
- Validation: JS syntax and history regression passed; browser text input, color/keyboard switching and geometry confirmed (44px input, 46px row, 64px bottom reserve). iPhone keyboard and ChatGPT host overlay have not been tested on a physical device.

## v18 — reference caption defaults
- New typed captions now default to heavy Gothic (weight 900; Hiragino Japanese family preferred), white fill and thick black outline.
- Outline follows font size (18% stroke width) during scaling. Existing layers retain their chosen styles.
- Exact reference font is unknown from the screenshot; this uses installed platform fonts, so glyph shapes may vary by device. Syntax and history regression checks passed.

## v19 — home title
- Replaced the opening screen heading with GUTS STUDIO. Adjusted responsive heading size to keep the settings controls alongside it on narrow screens.

## v20 — larger GUTS CUT heading
- Opening heading changed to GUTS CUT and increased from 20–26px to responsive 28–40px, weight 800. Settings controls remain beside the heading.

## v21 — GOLF GUTS five-color system
- Replaced authored UI colors with #E8DFD3, #D6C8B6, #3F3A36, #8B857E and #4F6B57. Main surfaces are warm beige, cards sand beige, main text brown, supporting text grey; green limited to active/primary controls.
- Rebuilt the three home promotional cards as palette-native SVG line illustrations. GUTS CUT wordmark uses bold GUTS/light CUT with deliberate spacing. Existing user photo/video pixels remain untouched.
- Rectangle defaults to sand beige; other shape previews use neutral tones and one green star. New captions use brown lettering with beige outline, superseding earlier white/black defaults. Text preset swatches use the five brand colors.
- Validation: browser home and rectangle creation inspected; JS syntax, history, gesture, rotation, guide tests passed. Authored hex-color audit found only the five palette codes (excluding #add DOM selector). Custom user-selected media/colors are not recolored automatically.
