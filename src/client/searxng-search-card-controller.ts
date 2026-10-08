/**
 * The SearXNG search page's staged form over the `web-search-searxng` settings
 * namespace. The provider carries no credential, so every field belongs to the
 * section and one save covers the whole page.
 */

import type {
  SettingsFieldSpec, SettingsFieldState, SettingsFormActions, SettingsFormShell, SettingsFormScope,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { SettingsFormModel, settingsTextField } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'

/**
 * Namespace of the SearXNG search provider. Spelled here rather than
 * imported: a client package must not depend on a Host package.
 */
export const SEARXNG_SEARCH_NS = 'web-search-searxng'

/**
 * The official-fallback switch, staged as hidden text but stored as a
 * boolean. Both positions write an explicit value so an inherited `true`
 * cannot prevent the user from disabling paid fallback.
 * @param field - field name inside the namespace section.
 * @returns the field's conversion spec.
 */
function settingsSwitchField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => value === true ? 'true' : 'false',
    parse: text => ({ kind: 'set', value: text === 'true' }),
  }
}

/** The search-provider fields this page edits. */
export interface SearxngSearchSettings {
  /** Instance endpoint; blank inherits `$SEARXNG_BASE_URL`. */
  baseURL?: string
  /** Comma-separated engine restriction; blank uses the instance default. */
  engines?: string
  /** Preferred result language; blank uses the instance default. */
  language?: string
  /**
   * Per-request official fallback: `true` lets one failed SearXNG request
   * degrade to the official route once, with a cost notice in the result.
   * Absent keeps the strict default: failures fail loudly, zero official
   * requests. The page renders this as a switch, never a text input.
   */
  allowOfficialFallback?: boolean
}

/** What the SearXNG search page renders. */
export interface SearxngSearchCardState extends SettingsFormShell {
  /** Instance endpoint. */
  baseURL: SettingsFieldState
  /** Engine restriction. */
  engines: SettingsFieldState
  /** Result language. */
  language: SettingsFieldState
  /** Official-fallback switch state ('true' when allowed); never rendered as an input. */
  allowOfficialFallback: SettingsFieldState
}

/** The registration-side face the SearXNG search page's slot entry injects. */
export interface SearxngSearchCardFace extends SettingsFormActions {
  hooks: {
    /** Page snapshot bound by the renderer as useSearxngSearchCard. */
    searxngSearchCard: SnapshotStore<SearxngSearchCardState>
  }
}

/** Bridges the `web-search-searxng` scope onto the page. */
export class SearxngSearchCardController {
  private readonly form: SettingsFormModel<SearxngSearchSettings>
  private readonly store: SnapshotStore<SearxngSearchCardState>

  /**
   * @param scope - the bound settings scope for the `web-search-searxng` namespace.
   */
  constructor(scope: SettingsFormScope<SearxngSearchSettings>) {
    this.form = new SettingsFormModel(
      scope,
      [
        settingsTextField('baseURL'),
        settingsTextField('engines'),
        settingsTextField('language'),
        settingsSwitchField('allowOfficialFallback'),
      ],
    )
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): SearxngSearchCardState {
    return {
      ...this.form.shell(),
      baseURL: this.form.field('baseURL'),
      engines: this.form.field('engines'),
      language: this.form.field('language'),
      allowOfficialFallback: this.form.field('allowOfficialFallback'),
    }
  }

  /**
   * Build the face the page's slot registration injects.
   * @returns the page's snapshot and its form actions.
   */
  inject(): SearxngSearchCardFace {
    return { hooks: { searxngSearchCard: this.store }, ...this.form.actions() }
  }

  /** Release configuration subscriptions. */
  dispose(): void { this.form.dispose() }
}
