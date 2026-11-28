# Owner-approved Spectrum recovery baseline

Confirmed working by the owner on November 27, 2026.

- Permanent complete preset: `config/spectrum-approved-default.json`.
- Working code recovery commit: `256f7db3fc52e0182d8803c152c3e69ef4f398cc`.
- Dedicated recovery branch: `recovery/spectrum-approved-20261127`.
- Published preset and built-in fallback must agree with the approved baseline.
- Spectrum's **Reset This Effect** restores the approved built-in fallback, not a subsequently published preset.
- Preserve all values (including color, gain, transparency and geometry). Do not change this approved baseline or its rendering as part of an unrelated fix. Obtain explicit owner approval before replacing the baseline.
- The independent GE protected Spectrum defaults workflow detects differences on main and pull requests. It does not itself enforce branch protection or prevent an authorized direct push.
- Live tuning remains available. If an intentionally published experimental preset differs, the check flags the difference; the recovery baseline remains unchanged.

Recovery: restore only the Spectrum profile from the approved JSON and compare the Spectrum-specific rendering functions against the recovery commit. Do not roll back the rest of the site.
