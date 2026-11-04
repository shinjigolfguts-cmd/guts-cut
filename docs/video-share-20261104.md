# iOS embedded share guard (v85)

The screenshot shows the host share sheet blank after file sharing. Its native cause has not been reproduced on an iPhone. JavaScript's share timeout cannot dismiss a host sheet.

For detected iOS embedded browsers, do not invoke navigator.share. Keep the generated blob and offer file download with explicit Files → Share → Save Video instructions. Provide a selectable Site URL for Safari, explicitly requiring re-selection when switching browser. Safari/standalone retain sharing. Normalize file MIME by removing codec parameters. Generation completion is 100%, explicitly separate from device saving; no Photos success is claimed.

Validation: JavaScript syntax checks pass. VM tests verify embedded iPhone does not call share, Safari and installed web-app cases do. Actual iPhone download, host share sheet, and Photos persistence remain unverified. Browser detection is heuristic. A web app cannot verify the chosen native share destination or force a Photos write. Existing generated output is retained for retry.
