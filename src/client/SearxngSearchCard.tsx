/** SearXNG settings and the staged opt-in official fallback checkbox. */

import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { Button, SettingsForm, SettingsValueField } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useState } from 'react'
import { formLabels } from './locales.ts'
import { EngineChoiceField, LanguageChoiceField } from './SearchChoiceFields.tsx'
import type { SearxngSearchCardFace } from './searxng-search-card-controller.ts'
import { checkLatestRelease, CURRENT_VERSION, RELEASES_URL, type UpdateCheck } from './update-check.ts'

/** Props the renderer binds for the SearXNG search page. */
export type SearxngSearchCardProps =
  PropsRuntime<'plugins.item'>
  & PropsLocale<'settings.webSearchSearxng'>
  & InjectFace<SearxngSearchCardFace>

/**
 * Render the SearXNG search provider's one-liner or its settings form, as the Plugins page asks.
 * The fallback checkbox is staged with the other fields and takes effect on save.
 * Update checks run only on click.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the form.
 */
export function SearxngSearchCard(props: SearxngSearchCardProps) {
  const { t } = props
  const state = props.useSearxngSearchCard(snapshot => snapshot)
  const [update, setUpdate] = useState<{ checking: boolean; result?: UpdateCheck }>({ checking: false })
  if (props.view === 'summary') return t('description')
  const fallbackAllowed = state.allowOfficialFallback.text === 'true'
  const disabled = !state.available || !state.writable || state.saving
  return (
    <>
      <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={fallbackAllowed}
            disabled={disabled}
            onChange={event => props.edit('allowOfficialFallback', String(event.currentTarget.checked))}
            aria-describedby="searxng-fallback-hint"
          />
          {t('fallbackLabel')}
        </label>
        <p id="searxng-fallback-hint">{t('fallbackHint')}</p>
        <SettingsValueField
          id="plugin-config-web-search-searxng-endpoint"
          label={t('baseUrl')}
          hint={t('baseUrlHint')}
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          invalidLabel={t('invalidValue')}
          disabled={disabled}
          {...state.baseURL}
          onEdit={text => props.edit('baseURL', text)}
          onReset={() => props.resetField('baseURL')}
        />
        <EngineChoiceField t={t} state={state.engines} disabled={disabled}
          onEdit={text => props.edit('engines', text)} onReset={() => props.resetField('engines')} />
        <LanguageChoiceField t={t} state={state.language} disabled={disabled}
          onEdit={text => props.edit('language', text)} onReset={() => props.resetField('language')} />
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
