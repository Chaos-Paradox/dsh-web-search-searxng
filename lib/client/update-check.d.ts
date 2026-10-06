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
export declare const CURRENT_VERSION = "0.1.0";
/** Releases page the card links to for notes and manual updates. */
export declare const RELEASES_URL = "https://github.com/Chaos-Paradox/dsh-web-search-searxng/releases";
/** What one check answered. */
export type UpdateCheck = 
/** A newer release exists; `latest` is its version without a leading v. */
{
    readonly kind: 'newer';
    readonly latest: string;
}
/** The installed version is current. */
 | {
    readonly kind: 'latest';
}
/** The lookup failed or the repository has no releases. */
 | {
    readonly kind: 'unknown';
};
/**
 * Compare two dotted numeric versions, ignoring a leading v.
 * @param a - one version, e.g. `v0.2.0` or `0.2.0`.
 * @param b - the other version.
 * @returns positive when `a` is newer, negative when older, zero when equal.
 */
export declare function compareVersions(a: string, b: string): number;
/**
 * Ask GitHub for the latest release and compare it with the installed version.
 * Every failure — offline, rate-limited, no releases, a malformed body — folds
 * into `unknown` rather than throwing: the card only ever renders a hint.
 * @param fetchImpl - the fetch to use, injectable for tests.
 * @returns the comparison outcome.
 */
export declare function checkLatestRelease(fetchImpl?: typeof fetch): Promise<UpdateCheck>;
//# sourceMappingURL=update-check.d.ts.map