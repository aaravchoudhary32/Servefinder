# Pilot guide: 5–10 student testers

Companion to `RUNBOOK.md` and `SECURITY.md`. This file is pilot-specific
process documentation — it makes no code, schema, or configuration
changes. Verified production baseline going into the pilot: SHA
`8276974`, 1,180 approved opportunities, 355 organizations, 502/502
unit / 26/26 a11y / 10/10 e2e / 22/22 integration tests passing.

Companion documents: `PILOT-FEEDBACK-FORM.md` (one copy per tester,
end of session) and `PILOT-ISSUE-TEMPLATE.md` (one copy per bug/issue
found).

---

## 1. Manual Supabase backup (Free plan — no upgrade, no secrets exposed)

Confirmed in `RUNBOOK.md`: the Supabase project is on the Free plan,
which has no automated backups or point-in-time recovery. Before real
pilot users start writing data, take one manual export by hand.

1. **Get the connection string** — Supabase dashboard → your project →
   Project Settings → Database → Connection string → **URI** tab. Copy
   it exactly as shown (it includes a password that must stay
   percent-encoded, which is why you copy it rather than retype it).
   Treat this string itself as a secret: don't paste it into a chat,
   an issue, or anywhere outside your own terminal.
2. **Run the export from a working directory outside git** — e.g. your
   Desktop or a dedicated backups folder, *not* the ServeFinder repo
   directory, so the file can never accidentally get committed:
   ```bash
   mkdir -p ~/servefinder-backups
   cd ~/servefinder-backups
   npx supabase db dump --db-url "<paste the connection string here>" -f servefinder-backup-$(date +%Y%m%d).sql
   ```
   This only reads from the database (`pg_dump` under the hood) — it
   cannot alter or delete anything.
3. **Verify it actually worked** before trusting it:
   ```bash
   ls -lh servefinder-backup-*.sql
   ```
   A file of at least a few hundred KB (this app's real data size) is
   a good sign; a 0-byte or missing file means the dump failed — check
   the terminal output for a connection error before assuming you have
   a backup.
4. **Store it somewhere durable and encrypted** — it contains student
   emails and profile data, so give it the same care as the live
   database (encrypted cloud storage, not just a laptop desktop long
   term). Do not commit it to git.
5. **Timing:** take one export right before the pilot starts (this
   command), and one more right after it ends, so you have a clean
   before/after snapshot of exactly what pilot data was created.

No plan upgrade, schema change, or destructive action is involved in
any of the above.

---

## 2. Pilot testing checklist

Give this to yourself (or a co-observer) to run through per tester, or
hand it to testers directly as a self-guided script. Test on both a
desktop/laptop browser and a phone if the tester has one — the mobile
pass matters as much as desktop.

- [ ] **Signup** — create an account with a real email the tester
      controls; confirm the welcome/landing state after signup makes
      it obvious what to do next.
- [ ] **Onboarding** — age, city/zip, and interests are asked for
      clearly; nothing feels like it's asking for more than necessary.
- [ ] **Focus selection** — pick 1–2 broad interests, then optionally
      drill into a specific focus area under one of them; confirm the
      focus list is easy to scan or search, not overwhelming.
- [ ] **Explore** — browse the full catalog (not just matches);
      confirm it's clear this is a broader list than the dashboard.
- [ ] **Filters** — filter by category and by commitment type; confirm
      results actually change and an empty/no-results state (if hit)
      makes sense rather than looking broken.
- [ ] **Match explanations** — open a few matched opportunities and
      read "Why this matches you"; ask the tester whether the stated
      reason (direct focus match vs. "related to your interest in X")
      matches their own sense of why it was shown.
- [ ] **Saving** — save an opportunity from the dashboard; confirm it
      shows up under Applications → Saved.
- [ ] **Dashboard** — the ranked match list loads, is understandable,
      and (if desired) Classic vs. Semantic mode toggle is at least
      noticed, even if not deeply tested.
- [ ] **Settings** — edit interests (add or remove a broad interest or
      focus), save, reload the page, and confirm the change stuck.
- [ ] **Applying** — click "Apply" on a real listing far enough to
      reach the organization's actual external application (no need to
      submit a real application to a real org unless the tester wants
      to).
- [ ] **Reporting an inaccurate listing** — use "Report an issue" on
      any listing (doesn't need to be a real problem — testing the
      mechanism itself is enough) and confirm the tester gets some
      acknowledgment that it was submitted.

---

## 3. Feedback collection

See `PILOT-FEEDBACK-FORM.md` — give one to each tester at the end of
their session (paste it into a Google Form, Typeform, or even a plain
email reply; the content matters more than the tool).

---

## 4. Privacy-conscious pilot procedure

- **Testers:** 5–10 student volunteers. Since these are minors, make
  sure whoever recruits them (you, a teacher, a club advisor) has
  actually told the testers — and their parent/guardian, if you're not
  already the one responsible for them — what they'll be doing (trying
  a volunteer-matching website and giving feedback) before they start.
  This is a casual usability pilot, not a study requiring formal IRB
  consent, but a plain-language heads-up is still the right thing to
  do.
- **Don't collect more than the app itself asks for.** ServeFinder's
  own signup/onboarding already asks for the minimum it needs (email,
  age, city/zip, interests). As the pilot organizer, don't separately
  collect anything beyond that for your own records — no phone
  numbers, no home addresses, no full legal names. A first name or
  tester number (e.g. "Tester 3") is enough to attribute feedback.
- **Never ask for or accept a password.** If a tester is stuck logging
  in, watch them type it themselves or walk them through "Forgot
  password?" — never have them tell it to you, and never type it into
  their account on their behalf.
- **Tell every tester, before they start:** "Don't put anything
  sensitive into any field — no full home address, no medical
  information, nothing you wouldn't want a stranger to see. Use a real
  email you check, but keep every other answer general."
- **How to report bugs/feedback, explained to testers up front:**
  - Anything about a *specific listing* (wrong info, seems fake,
    outdated) → use that listing's "Report an issue" link right there
    in the app.
  - General impressions/bugs during the session → tell you directly
    (you're observing) or use the "Feedback" link in the nav bar.
  - The structured end-of-session write-up → `PILOT-FEEDBACK-FORM.md`.
  - Anything that feels broken enough to block them → tell you
    immediately rather than waiting for the form.

---

## 5. Manual VoiceOver test (macOS) — primary student journey

This has not been run yet in this project; here are the exact steps to
run it yourself. Do this in Safari or Chrome on a Mac.

1. **Turn VoiceOver on:** press `Cmd+F5` (or ask Siri "turn on
   VoiceOver"). A quick tutorial may pop up the first time — you can
   skip it. Turn it off the same way (`Cmd+F5`) when you're done.
2. **Core commands you'll use:**
   - `Control+Option` is the "VO" modifier used below.
   - `VO+Right Arrow` / `VO+Left Arrow` — move to the next/previous
     item.
   - `VO+Space` — activate the currently focused link/button.
   - `Tab` / `Shift+Tab` — move between form fields and controls (VO
     lets these through normally on most pages).
   - `VO+U` — open the rotor, then use arrow keys to jump by
     **Headings**, **Links**, or **Form Controls** — the fastest way to
     check heading order and skip-navigation.
3. **Walk the journey, listening for the following at each step:**
   - **Home page** (`/`): first item announced should make sense as a
     page title/heading, not a stray icon or empty label.
   - **Signup/Login** (`/login`): every field announces a label (not
     just a placeholder); after a failed attempt, VoiceOver should
     *interrupt* and speak the error automatically without you having
     to navigate to find it.
   - **Onboarding** (`/onboarding`): use the rotor's Form Controls list
     — every interest/focus button should announce its name and
     "pressed"/"not pressed" state, not just "button."
   - **Explore & filters** (`/explore`): the two filter dropdowns
     should announce as "Filter by category" / "Filter by commitment
     type," not just "pop-up button."
   - **Opening an opportunity**: VO+U → Headings should show a sane
     order (page heading, then each opportunity's own heading) with no
     skipped levels.
   - **Saving**: after clicking Save, listen for any confirmation —
     note if there's silence (this is expected to be silent today;
     it's fine to flag it as a finding if it feels wrong).
   - **Dashboard** (`/dashboard`): reload the page and check whether
     VoiceOver says anything like "loading" while matches are being
     fetched.
   - **Settings** (`/settings`): edit an interest, save, and confirm
     VoiceOver actually speaks the "Saved." confirmation without you
     needing to go find it.
   - **Report an issue**: opening it should announce it as a dialog
     with a title; Tab should stay inside the dialog until you dismiss
     it; closing it (Escape or Cancel) should return you to the button
     you opened it from, not drop you somewhere else on the page.
4. **Write down anything that was silent when it shouldn't have been,
   announced the wrong thing, or dropped focus somewhere unexpected** —
   file each as its own entry in `PILOT-ISSUE-TEMPLATE.md`.

---

## 6. Existing analytics to monitor during the pilot

Nothing new was built for this — these are the dashboards and tables
that already exist. With only 5–10 testers, treat every percentage as
directional, not statistically meaningful.

- **`/admin/analytics`** (admin login required) — trailing-30-day
  window:
  - *Unique active students, onboarding completion, saves,
    applications submitted, application completion* — with 5–10
    testers these will be small integers; use them to sanity-check
    "did people actually get through onboarding and try saving/
    applying," not to compute a meaningful rate.
  - *Classic vs. Semantic matching table* — the page itself already
    shows "Not enough data yet" for helpfulness below 10 ratings; at
    pilot scale, expect to see that message for most/all of this
    table. Don't read a percentage that does render as a verdict on
    which algorithm is "better" — the sample is too small.
- **`/admin/reports`** — this is where both "Report an issue" (on a
  listing) and the general "Feedback" nav link land. Filter to
  `received` (the default) during and right after the pilot to see
  everything testers flagged in-app, separate from what they tell you
  verbally or via `PILOT-FEEDBACK-FORM.md`.
- **`/admin/error-log`** — check this if a tester says something felt
  "broken" or gave an error; it holds structured server-side errors
  with the route and context, which is more reliable than trying to
  reconstruct what happened from a tester's description alone.
- **`/admin/ingestion-log`** — only relevant if a tester reports a
  listing that seems stale, missing, or duplicated; check whether the
  relevant source's periodic fetch has been failing.

When you write the post-pilot summary, cross-reference what these
dashboards show against what `PILOT-FEEDBACK-FORM.md` responses say —
if a tester reports confusion that doesn't show up as a drop-off in
`/admin/analytics`, that's still worth fixing; the analytics are a
cross-check, not a replacement for what testers actually tell you.
