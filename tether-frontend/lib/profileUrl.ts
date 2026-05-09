/**
 * lib/profileUrl.ts
 *
 * Canonical URL helpers for public creator and business profile pages.
 *
 * Creator:  statvora.in/@username
 * Business: statvora.in/b/@username
 *
 * Always use these helpers instead of building strings by hand so a
 * future domain change or path change only requires editing this file.
 */

const ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "https://statvora.in";

/** Relative path for a creator public profile: /@username */
export function creatorProfilePath(username: string): string {
  return `/@${username}`;
}

/** Relative path for a business public profile: /b/@username */
export function businessProfilePath(username: string): string {
  return `/b/@${username}`;
}

/** Absolute URL for a creator public profile */
export function creatorProfileUrl(username: string): string {
  return `${ORIGIN}/@${username}`;
}

/** Absolute URL for a business public profile */
export function businessProfileUrl(username: string): string {
  return `${ORIGIN}/b/@${username}`;
}

/** Pick the right path given a user_type */
export function profilePath(username: string, userType: "creator" | "business"): string {
  return userType === "business" ? businessProfilePath(username) : creatorProfilePath(username);
}
