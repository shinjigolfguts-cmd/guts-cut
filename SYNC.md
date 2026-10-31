# Sites → GitHub automatic backup

Source project: appgprj_6ae595af47b0819185f5e11d6e65ceea
Destination: shinjigolfguts-cmd/guts-cut, main (private)
Cadence: hourly, Asia/Tokyo. This is a ChatGPT cloud task, not a GitHub Actions workflow or real-time/bidirectional synchronization.

Use Sites skill and freshly issued source access, never browser login or persisted tokens. Open the source using site-workflow in a clean checkout. Only read source; do not commit, publish, change audience or push to Sites during this backup. Acquire GitHub access through its connector. Stop and report when access is unavailable.

Read .sync/sites-state.json from GitHub main; it records the last synchronized source commit and blob hashes/modes. Resolve main to a full commit SHA and use that immutable ref for all destination reads. List source tracked files from its committed tree, excluding secrets, .env, credentials, runtime uploads, .git, node_modules and the reserved GitHub-only paths README.md, SYNC.md, .sync/, .github/. Include .openai/hosting.json, dist/ and docs/. Never copy arbitrary untracked local files.

Three-way comparison: B=baseline, S=current source, D=current destination. Compare (blob SHA, mode) including absence. Examine union of baseline and source paths, preserving all GitHub-only files. For each path: if D==S, no write; if D==B, apply S; otherwise stop whole run and report a conflict (including deletions or destination-only edits on managed paths). Do not advance baseline on conflict. No force-push.

If nothing changed in source and all managed paths still match, exit without commit or notification. If source commit changed but content is equal, update only state. Upload changed blobs via GitHub connector, base64 for binary. Build a tree based on current GitHub commit's tree, with changed/deleted paths and updated .sync/sites-state.json in the SAME commit. Set parent=current main. Update main with expected_sha=current main and force=false. If lease rejected, reread main and recompute; never overwrite concurrent work. At most one recompute/retry, then report.

Read back main and full tree and verify each managed SHA/mode against source and verify state. Include source commit in commit message. Preserve private visibility, repository-only files, app behavior and existing Site deployment. Report only errors/conflicts requiring action; remain silent on successful/no-change runs. Do not send email or other external messages.
