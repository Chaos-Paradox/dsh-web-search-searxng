/** List controls over the existing staged engine and language string fields. */

import { Button, Input, Tag, type SettingsFieldState } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactNode } from 'react'
import type { SearxngSearchSettingsLocaleKey } from './locales.ts'

type Translate = (key: SearxngSearchSettingsLocaleKey) => string

/** Common names from https://docs.searxng.org/user/configured_engines.html; instance configuration determines availability. */
const ENGINE_GROUPS = [
  { label: 'enginesWeb', engines: [
    ['google', 'Google'], ['google cse', 'Google CSE'], ['bing', 'Bing'],
    ['duckduckgo', 'DuckDuckGo'], ['brave', 'Brave'], ['yahoo', 'Yahoo'],
  ] },
  { label: 'enginesNews', engines: [['google news', 'Google News'], ['bing news', 'Bing News']] },
  { label: 'enginesScience', engines: [
    ['google scholar', 'Google Scholar'], ['arxiv', 'arXiv'], ['semantic scholar', 'Semantic Scholar'],
  ] },
  { label: 'enginesKnowledge', engines: [['github', 'GitHub'], ['stackoverflow', 'Stack Overflow'], ['wikipedia', 'Wikipedia']] },
] as const

const ENGINE_NAMES = new Set<string>(ENGINE_GROUPS.flatMap(group => group.engines.map(([name]) => name)))
const LANGUAGES = [
  ['', 'languageDefault'], ['all', 'languageAll'], ['zh-CN', 'languageZhCN'], ['zh-TW', 'languageZhTW'],
  ['en', 'languageEn'], ['ja', 'languageJa'], ['ko', 'languageKo'], ['fr', 'languageFr'],
  ['de', 'languageDe'], ['es', 'languageEs'], ['ru', 'languageRu'],
] as const
const LANGUAGE_CODES = new Set<string>(LANGUAGES.map(([code]) => code))
const CUSTOM_LANGUAGE = '__custom_language__'

interface ChoiceFieldProps {
  t: Translate
  state: SettingsFieldState
  disabled: boolean
  onEdit: (text: string) => void
  onReset: () => void
}

/** Preserve custom engine names, including names containing spaces, when editing a selection. */
function engineNames(text: string): string[] {
  return [...new Set(text.split(',').map(name => name.trim()).filter(Boolean))]
}

function ChoiceField(props: ChoiceFieldProps & {
  label: 'engines' | 'language'
  hint: 'enginesHint' | 'languageHint'
  children: ReactNode
}) {
  return (
    <fieldset disabled={props.disabled} aria-label={props.t(props.label)} aria-describedby={`searxng-${props.label}-hint`}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {props.t(props.label)}
        {props.state.overridden && <>
          <Tag tone="neutral">{props.t('overridden')}</Tag>
          <Button variant="outline" size="sm" disabled={props.disabled} onClick={props.onReset}>{props.t('reset')}</Button>
        </>}
      </legend>
      {props.children}
      <p id={`searxng-${props.label}-hint`} style={{ fontSize: 12, opacity: 0.7 }}>
        {props.t(props.state.invalid ? 'invalidValue' : props.hint)}
      </p>
    </fieldset>
  )
}

/** Engine checkboxes grouped by search purpose; custom selections survive every list edit. */
export function EngineChoiceField(props: ChoiceFieldProps) {
  const [customDraft, setCustomDraft] = useState<{ input: string; selection: string } | null>(null)
  const selected = engineNames(props.state.text)
  const custom = selected.filter(name => !ENGINE_NAMES.has(name))
  const toggle = (name: string, checked: boolean) => {
    props.onEdit((checked ? [...selected, name] : selected.filter(value => value !== name)).join(','))
  }
  return (
    <ChoiceField {...props} label="engines" hint="enginesHint" onReset={() => { setCustomDraft(null); props.onReset() }}>
      <p style={{ marginTop: 0, fontSize: 12 }}>{props.t(selected.length ? 'enginesSelected' : 'enginesDefault')}</p>
      {ENGINE_GROUPS.map(group => (
        <div key={group.label} role="group" aria-label={props.t(group.label)} style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, opacity: 0.7 }}>{props.t(group.label)}</p>
          <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px 16px', listStyle: 'none', margin: 0, padding: 0 }}>
            {group.engines.map(([name, label]) => (
              <li key={name}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={selected.includes(name)} disabled={props.disabled}
                    onChange={event => toggle(name, event.currentTarget.checked)} />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <details>
        <summary>{props.t('enginesCustom')}</summary>
        {custom.length > 0 && <ul style={{ listStyle: 'none', padding: 0 }}>
          {custom.map(name => <li key={name}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked disabled={props.disabled}
                onChange={event => toggle(name, event.currentTarget.checked)} />
              {name}
            </label>
          </li>)}
        </ul>}
        <label htmlFor="searxng-custom-engines">{props.t('enginesCustomNames')}</label>
        <Input id="searxng-custom-engines" value={customDraft?.selection === props.state.text ? customDraft.input : custom.join(',')} disabled={props.disabled}
          onChange={event => {
            const input = event.currentTarget.value
            const selection = engineNames([...selected.filter(name => ENGINE_NAMES.has(name)), input].join(',')).join(',')
            // Keep unfinished separators while typing; external selections still replace the draft.
            setCustomDraft({ input, selection })
            props.onEdit(selection)
          }}
          aria-describedby="searxng-custom-engines-hint" />
        <p id="searxng-custom-engines-hint" style={{ fontSize: 12, opacity: 0.7 }}>{props.t('enginesCustomHint')}</p>
      </details>
      {custom.length > 0 && <p style={{ fontSize: 12 }}>{props.t('enginesCustomSelected')}: {custom.join(', ')}</p>}
    </ChoiceField>
  )
}

/** Language dropdown with a custom-code escape hatch for existing or uncommon languages. */
export function LanguageChoiceField(props: ChoiceFieldProps) {
  const [customMode, setCustomMode] = useState(false)
  const custom = customMode || !LANGUAGE_CODES.has(props.state.text)
  return (
    <ChoiceField {...props} label="language" hint="languageHint" onReset={() => { setCustomMode(false); props.onReset() }}>
      <select aria-label={props.t('language')} disabled={props.disabled} value={custom ? CUSTOM_LANGUAGE : props.state.text}
        aria-describedby="searxng-language-hint" aria-invalid={props.state.invalid || undefined}
        style={{ width: '100%', padding: 8, borderRadius: 8, font: 'inherit', color: 'inherit', background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l2)' }}
        onChange={event => {
          const value = event.currentTarget.value
          setCustomMode(value === CUSTOM_LANGUAGE)
          if (value !== CUSTOM_LANGUAGE) props.onEdit(value)
        }}>
        {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{props.t(label)}</option>)}
        <option value={CUSTOM_LANGUAGE}>{props.t('languageCustom')}</option>
      </select>
      {custom && <>
        <label htmlFor="searxng-custom-language">{props.t('languageCustomCode')}</label>
        <Input id="searxng-custom-language" value={props.state.text} disabled={props.disabled}
          onChange={event => props.onEdit(event.currentTarget.value)} />
      </>}
    </ChoiceField>
  )
}
