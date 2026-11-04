# Batch recovery repair (v79)

Confirmed source defect: multiple selected videos existed only inside a disposable dialog closure, not editor media state. Closing after an error, cancellation, or split handling exposed the empty editor. Screenshot alone cannot establish whether the reported iPhone also experienced process eviction/reload.

Batch selection and output now live in a persistent in-page batch state. A dedicated inline view replaces the empty preview while joining. Failure or cancellation retains selection for retry; completed output is reused. Worker failures, message deserialization failures, timeout and parser incompatibility are separated; only parser incompatibility starts the existing conversion fallback. Native save is invoked from a button after duration metadata is ready. No automatic reset on save. Back/resume preserves the batch. A session marker explains interrupted work after a browser reload; files cannot be restored across reload by this implementation.

Cloud Chromium tests: induced Worker constructor failure, same-selection retry using two actual 2-second H.264/AAC clips, output duration validation, cached-output reuse, induced parser failure followed by conversion cancellation, busy flag release, actual 20/50 copies of a 2-second clip with 40/100-second output metadata, real conversion of landscape-with-audio plus portrait-without-audio, and save button reaching download-complete UI. JavaScript syntax and whitespace checks passed.

Not confirmed: the user's exact iPhone failure, mobile process eviction, long/high-resolution 20–50-clip conversion, native Photos saving, frame-exact or lossless fallback conversion. Existing GitHub synchronization is unchanged.
