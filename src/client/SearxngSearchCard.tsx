/**
 * The SearXNG search provider's settings page: its instance endpoint, engine
 * restriction, and result language. Every field belongs to the settings
 * section — the provider carries no credential, so the three text fields share
 * one declaration row each in FIELDS.
 */

import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { Button, SettingsForm, SettingsValueField } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useState } from 'react'
import { formLabels, type SearxngSearchSettingsLocaleKey } from './locales.ts'
import type { SearxngSearchCardFace, SearxngSearchCardState, SearxngSearchSettings } from './searxng-search-card-controller.ts'
import { checkLatestRelease, CURRENT_VERSION, RELEASES_URL, type UpdateCheck } from './update-check.ts'

/** Props the renderer binds for the SearXNG search page. */
export type SearxngSearchCardProps =
  PropsRuntime<'plugins.item'>
  & PropsLocale<'settings.webSearchSearxng'>
  & InjectFace<SearxngSearchCardFace>

/** One row per section field, in page order. */
const FIELDS: readonly {
  field: keyof SearxngSearchSettings & keyof SearxngSearchCardState
  id: string
  labelKey: SearxngSearchSettingsLocaleKey
  hintKey: SearxngSearchSettingsLocaleKey
}[] = [
  { field: 'baseURL', id: 'plugin-config-web-search-searxng-endpoint', labelKey: 'baseUrl', hintKey: 'baseUrlHint' },
  { field: 'engines', id: 'plugin-config-web-search-searxng-engines', labelKey: 'engines', hintKey: 'enginesHint' },
  { field: 'language', id: 'plugin-config-web-search-searxng-language', labelKey: 'language', hintKey: 'languageHint' },
]

/**
 * Render the SearXNG search provider's one-liner or its settings form, as the Plugins page asks.
 * The update check fires only on the button's click — rendering never fetches.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the form.
 */
export function SearxngSearchCard(props: SearxngSearchCardProps) {
  const { t } = props
  const state = props.useSearxngSearchCard(snapshot => snapshot)
  const [update, setUpdate] = useState<{ checking: boolean; result?: UpdateCheck }>({ checking: false })
  if (props.view === 'summary') return t('description')
  return (
    <>
      <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
        {FIELDS.map(({ field, id, labelKey, hintKey }) => (
          <SettingsValueField
            key={id}
            id={id}
            label={t(labelKey)}
            hint={t(hintKey)}
            overriddenLabel={t('overridden')}
            resetLabel={t('reset')}
            invalidLabel={t('invalidValue')}
            disabled={!state.writable}
            {...state[field]}
            onEdit={(text) => { props.edit(field, text) }}
            onReset={() => { props.resetField(field) }}
          />
        ))}
      </SettingsForm>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <span>{t('currentVersion')}: v{CURRENT_VERSION}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={update.checking}
          onClick={() => {
            setUpdate({ checking: true })
            void checkLatestRelease().then(result => setUpdate({ checking: false, result }))
          }}
        >
          {update.checking ? t('checkingUpdate') : t('checkUpdate')}
        </Button>
        {update.result?.kind === 'newer' && (
          <span>
            {t('updateAvailable')} v{update.result.latest}
            {' · '}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer">{t('updateReleases')}</a>
            {' · '}
            {t('updateHowTo')}
          </span>
        )}
        {update.result?.kind === 'latest' && <span>{t('updateLatest')}</span>}
        {update.result?.kind === 'unknown' && <span>{t('updateFailed')}</span>}
      </div>
    </>
  )
}
