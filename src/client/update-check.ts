/**
 * Latest-release lookup behind the settings card's "check for updates" button.
 * The lookup fires only on an explicit click — the card renders and idles
 * without any network traffic, matching the provider's privacy posture.
 * @module dsh-web-search-searxng/client/update-check
 */

/**
 * This package's own version. Bump with package.json (the provider's
 * USER_AGENT follows the same rule).
 */
export const CURRENT_VERSION = '0.3.0'

/** GitHub repository hosting the plugin's releases. */
const REPO = 'Chaos-Paradox/dsh-web-search-searxng'

/** Releases page the card links to for notes and manual updates. */
export const RELEASES_URL = `https://github.com/${REPO}/releases`

/** The latest release's lookup endpoint; api.github.com allows cross-origin reads. */
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`

/** What one check answered. */
export type UpdateCheck =
  /** A newer release exists; `latest` is its version without a leading v. */
  | { readonly kind: 'newer'; readonly latest: string }
  /** The installed version is current. */
  | { readonly kind: 'latest' }
  /** The lookup failed or the repository has no releases. */
  | { readonly kind: 'unknown' }

/**
 * Compare two dotted numeric versions, ignoring a leading v.
 * @param a - one version, e.g. `v0.2.0` or `0.2.0`.
 * @param b - the other version.
 * @returns positive when `a` is newer, negative when older, zero when equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.')
  const pb = b.replace(/^v/i, '').split('.')
  for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
    const na = Number.parseInt(pa[index] ?? '0', 10) || 0
    const nb = Number.parseInt(pb[index] ?? '0', 10) || 0
    if (na !== nb) return na - nb
  }
  return 0
}

/**
 * Ask GitHub for the latest release and compare it with the installed version.
 * Every failure — offline, rate-limited, no releases, a malformed body — folds
 * into `unknown` rather than throwing: the card only ever renders a hint.
 * @param fetchImpl - the fetch to use, injectable for tests.
 * @returns the comparison outcome.
 */
export async function checkLatestRelease(
  fetchImpl: typeof fetch = fetch,
): Promise<UpdateCheck> {
  try {
    const response = await fetchImpl(LATEST_RELEASE_URL, {
      headers: { accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return { kind: 'unknown' }
    const body = await response.json() as { tag_name?: unknown }
    const tag = typeof body.tag_name === 'string' ? body.tag_name : ''
    if (tag.length === 0) return { kind: 'unknown' }
    return compareVersions(tag, CURRENT_VERSION) > 0
      ? { kind: 'newer', latest: tag.replace(/^v/i, '') }
      : { kind: 'latest' }
  } catch {
    return { kind: 'unknown' }
  }
}
