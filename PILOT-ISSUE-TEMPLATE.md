# Pilot issue template

Copy this block once per issue found during the pilot (via direct
observation, `PILOT-FEEDBACK-FORM.md`, `/admin/reports`, or
`/admin/error-log`). After the pilot, use the severity field to decide
what actually gets fixed first — per the standing instruction, only
issues with real pilot evidence behind them.

```
### [SEVERITY] Short title

- **Severity:** Critical / High / Medium / Low
- **Source:** Direct observation / Feedback form / In-app report / Error log
- **Tester(s) affected:** (tester ID(s), or "N/A" if from error log only)
- **Device/browser:** e.g. iPhone Safari, Mac Chrome
- **Where:** page/route
- **Steps to reproduce:**
  1.
  2.
  3.
- **Expected:**
- **Actual:**
- **Related evidence:** (screenshot, error-log entry id, or exact
  feedback-form quote)
- **Suggested fix (optional, not required):**
- **Status:** New / Confirmed / Fixed / Won't fix
```

## Severity definitions (for this app, at pilot scale)

- **Critical** — data exposure, security issue, account takeover, or
  something that makes the app completely unusable for a student
  (can't sign up, can't log in, app crashes). Fix before telling any
  more testers to use it.
- **High** — a core journey step is broken or produces a clearly wrong
  result: onboarding doesn't save, a save/apply action silently fails,
  a match is actively misleading (claims a direct focus match that
  isn't real), a listing is fake/scam-like. Fix before wider launch.
- **Medium** — confusing, annoying, or accessibility-limiting, but a
  workaround exists and it doesn't produce wrong data or block the
  journey (e.g. an unclear label, a missing loading indicator, a
  layout glitch on one screen size).
- **Low** — cosmetic, a nice-to-have, or a single tester's preference
  that didn't come up for anyone else (e.g. "I wish the button was a
  different color").

Don't assign Critical/High based on how it looks in code — assign it
based on what a real tester actually hit. If only one of 5–10 testers
noticed something and couldn't reproduce it, that's real evidence too,
just weaker — say so in the issue rather than inflating or dismissing
it.
