// Shared distance-resolution logic — previously duplicated almost
// verbatim between app/dashboard/page.tsx's resolveDistanceMiles() and
// app/onboarding/page.tsx's resolvePreviewDistance(). Extracted here as
// part of the CS/Engineering batch's delivery-mode work, since both
// call sites needed the same new distanceLabel() logic too.

import { haversineMiles } from "./geo";
import type { Coordinates } from "./geocode";
import type { DeliveryMode } from "./availabilityStatus";

export type LocatableOpportunity = {
  latitude: number | null;
  longitude: number | null;
};

// Real coordinates win. When either side is missing, the real distance is
// genuinely unknown — return null rather than fabricating one. This
// function only ever answers "how far is this opportunity from the
// student," or "we don't know" — it has no opinion on whether a distance
// even applies (that's delivery_mode's job, applied downstream in
// lib/matching.ts's isWithinRange()/distanceFit()). Previously, before
// that hard filter existed, an unresolved distance fell back to the
// student's own maxDistanceMiles, which silently made the filter pass
// for every opportunity and displayed a fake, misleadingly-precise
// distance ("10 miles away" for something thousands of miles away) —
// confirmed live. Callers must treat null the same way regardless of
// *why* it's null (failed geocode, unresolved student location, or a
// virtual opportunity with no address at all) — this function makes no
// such distinction on purpose; that distinction belongs to
// delivery_mode, never to whether coordinates happen to be missing.
export function resolveDistanceMiles(
  studentCoords: Coordinates | null,
  opportunity: LocatableOpportunity
): number | null {
  if (studentCoords && opportunity.latitude != null && opportunity.longitude != null) {
    return Math.round(
      haversineMiles(studentCoords.lat, studentCoords.lng, opportunity.latitude, opportunity.longitude)
    );
  }
  return null;
}

// Display text for a match card's distance line. A virtual or hybrid
// opportunity never shows a mileage figure — even if it happens to have
// resolvable coordinates (an org's mailing address, say), showing "12
// miles away" would wrongly imply the student needs to travel there.
export function distanceLabel(
  distanceMiles: number | null,
  deliveryMode: DeliveryMode | null | undefined
): string {
  const mode = deliveryMode ?? "in_person";
  if (mode === "virtual") return "Virtual";
  if (mode === "hybrid") return "Hybrid — virtual option available";
  return distanceMiles !== null ? `${distanceMiles} miles away` : "Distance unavailable";
}

// ---------- /explore only, below this line ----------
//
// Dashboard's distanceLabel() above is only ever called on an in_person
// opportunity that already survived isWithinRange() — a null distance
// there is a should-never-happen fallback, not a real display case.
// /explore is different on purpose: it shows every opportunity
// regardless of distance (never hides one just for being far, or for
// having no coordinates at all), so an unresolved in_person location
// needs its own honest label — never a number, and never worded so it
// could be misread as "nearby."
export function explorerLocationLabel(
  distanceMiles: number | null,
  deliveryMode: DeliveryMode | null | undefined
): string {
  const mode = deliveryMode ?? "in_person";
  if (mode === "virtual") return "Virtual";
  if (mode === "hybrid") return "Hybrid — virtual option available";
  return distanceMiles !== null ? `${distanceMiles} miles away` : "Location not verified";
}

// True only for a resolved, real in_person distance beyond the
// student's own radius — never true for virtual/hybrid (distance-
// independent by design) and never true for an unresolved location
// (that's "unknown," not "confirmed far away" — a different fact,
// labeled by explorerLocationLabel above instead).
export function isOutsideRadius(
  distanceMiles: number | null,
  deliveryMode: DeliveryMode | null | undefined,
  maxDistanceMiles: number
): boolean {
  const mode = deliveryMode ?? "in_person";
  if (mode !== "in_person" || distanceMiles === null) return false;
  return distanceMiles > maxDistanceMiles;
}
