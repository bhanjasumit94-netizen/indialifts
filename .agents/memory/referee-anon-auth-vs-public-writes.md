---
name: Referee mobile auth vs signal writes
description: Why mobile referee pages can submit signals but fail to show current lifter, while desktop admin works fine.
---

Referee phones (opened via QR to `#/signals/:station`) have no credentials and get
signed in anonymously via Firebase Auth. `referee_signals/*` is documented as
publicly readable/writable (no auth required), so signal submission works even
when the anonymous sign-in never completed. But `competitions/*` and
`lifters/*` reads are auth-gated — if anonymous sign-in fails (transient
network issue, common on venue wifi/cellular) and there's no retry, the
referee device is left permanently unauthenticated for that page load. The
result: mobile shows "Waiting for competition to start…" or blank, desktop
(already authenticated as admin) shows everything correctly, and referee
signal writes still succeed — a confusing but self-consistent symptom set.

**Why:** the original code attempted `signInAnonymously` exactly once on
route detection and only logged on failure; no retry, no user-visible error.

**How to apply:** any "works on desktop, broken on mobile referee page,
writes succeed but reads don't" report should raise this as the prime
suspect before looking for mobile-only CSS/JS conditionals. Fix pattern:
retry anonymous sign-in with backoff, guard against overlapping sign-in
chains, retry again on `online`/visibility regain, and surface a distinct
"connection failed" message instead of always showing the generic
"waiting" copy so it isn't mistaken for a data/timing issue.
