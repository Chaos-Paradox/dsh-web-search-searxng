/** Field-level bundle changes recorded atomically in the profile YAML document. */
import { isDeepStrictEqual } from 'node:util'
import { isMap, isSeq, parseDocument, Scalar, visit } from 'yaml'
import type { Document } from 'yaml'

/** One bundle's requested field writes and settings fields to track. */
export interface BundleConfigEffect {
  readonly id: string
  readonly set?: Readonly<Record<string, string | boolean | number | null>>
  readonly track?: readonly string[]
}

type Value = { present: false } | { present: true; value: unknown }
type Change = { before: Value; after: Value; track: boolean; hadConfig: boolean }
type Journal = Record<string, Record<string, Record<string, Change>>>
const PREFIX = 'dsh-config-effects/v1: '

/** Parse a profile patch while retaining comments and loader expression tags.
 * @param text Profile YAML.
 * @returns Mutable YAML document.
 */
export function configEffectDocument(text: string): Document {
  const document = parseDocument(text, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value: string) => ({ __jsExpr: value }) }] })
  if (document.errors[0] !== undefined) throw document.errors[0]
  if (!isSeq(document.contents)) throw new Error('Profile patch must be a YAML sequence')
  return document
}

function journalOf(document: Document): Journal {
  const comments: (string | null | undefined)[] = [document.commentBefore, document.comment]
  visit(document, { Node(_key, node) { comments.push(node.commentBefore, node.comment) } })
  const lines = comments.flatMap(comment => (comment ?? '').split('\n')).filter(line => line.trimStart().startsWith(PREFIX))
  if (lines.length > 1) throw new Error('Duplicate bundle configuration journal')
  if (lines.length === 0) return {}
  const data: unknown = JSON.parse(lines[0]!.trimStart().slice(PREFIX.length))
  if (!record(data)) throw new Error('Invalid bundle configuration journal')
  for (const rows of Object.values(data)) {
    if (!record(rows)) throw new Error('Invalid bundle configuration journal rows')
    for (const fields of Object.values(rows)) {
      if (!record(fields)) throw new Error('Invalid bundle configuration journal fields')
      for (const change of Object.values(fields)) {
        if (!record(change) || !value(change.before) || !value(change.after) || typeof change.track !== 'boolean' || typeof change.hadConfig !== 'boolean') throw new Error('Invalid bundle configuration journal value')
      }
    }
  }
  return data as Journal
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function value(candidate: unknown): candidate is Value {
  return record(candidate) && (candidate.present === false || (candidate.present === true && Object.hasOwn(candidate, 'value')))
}
function saveJournal(document: Document, journal: Journal): void {
  const strip = (text: string | null | undefined): string | null => {
    const result = (text ?? '').split('\n').filter(line => !line.trimStart().startsWith(PREFIX)).join('\n')
    return result || null
  }
  document.commentBefore = strip(document.commentBefore)
  document.comment = strip(document.comment)
  visit(document, { Node(_key, node) {
    node.commentBefore = strip(node.commentBefore)
    node.comment = strip(node.comment)
  } })
  if (Object.keys(journal).length > 0) document.comment = [document.comment, PREFIX + JSON.stringify(journal)].filter(Boolean).join('\n')

}
function rowIndex(document: Document, id: string): number {
  if (!isSeq(document.contents)) throw new Error('Profile patch must be a YAML sequence')
  const matches = document.contents.items.flatMap((item, index) => isMap(item) && document.getIn([index, 'id']) === id && item.has('config') && !item.has('insert') ? [index] : [])
  if (matches.length > 1) throw new Error(`Multiple profile config overrides for "${id}"; consolidate them before enabling bundle config effects`)
  return matches[0] ?? -1
}
function configOf(document: Document, id: string): Record<string, unknown> {
  const index = rowIndex(document, id)
  if (index < 0) return {}
  const node = document.getIn([index, 'config'], true)
  if (!isMap(node)) throw new Error(`Configuration for "${id}" must be a mapping`)
  return node.toJSON() as Record<string, unknown>
}
function fieldOf(config: Record<string, unknown>, field: string): Value {
  return Object.hasOwn(config, field) ? { present: true, value: config[field] } : { present: false }
}
function writeField(document: Document, id: string, field: string, desired: Value, preserveEmpty = false): void {
  let index = rowIndex(document, id)
  if (index < 0) {
    if (!desired.present) return
    document.add(document.createNode({ id, config: {} }))
    if (!isSeq(document.contents)) throw new Error('Profile patch must be a YAML sequence')
    index = document.contents.items.length - 1
  }
  if (desired.present) document.setIn([index, 'config', field], document.createNode(desired.value))
  else document.deleteIn([index, 'config', field])
  const config = document.getIn([index, 'config'], true)
  const row = document.getIn([index], true)
  if (!preserveEmpty && isMap(config) && config.items.length === 0 && isMap(row)) {
    row.delete('config')
    if (row.items.every(pair => String(pair.key) === 'id' || String(pair.key) === 'name')) document.delete(index)
  }
  visit(document, { Map(_key, node) {
    if (node.items.length !== 1 || typeof node.get('__jsExpr') !== 'string') return
    const expression = new Scalar(node.get('__jsExpr'))
    expression.tag = 'tag:yaml.org,2002:js'
    return expression
  } })
}

/** Apply new owners once and reverse removed owners, comparing each last write.
 * The caller holds the profile lock and persists this document atomically.
 * @param document Profile patch, including its journal.
 * @param active Owners in bundle order with their manifest declarations.
 * @param inherited Effective configs before the profile layer, for whole-config patch semantics.
 * @returns Conflict descriptions; conflicting fields retain the user's later value.
 */
export function reconcileConfigEffects(
  document: Document,
  active: readonly { owner: string; effects: readonly BundleConfigEffect[] }[],
  inherited: ReadonlyMap<string, Record<string, unknown>>,
): string[] {
  const journal = journalOf(document)
  const conflicts: string[] = []
  const owners = new Set(active.map(item => item.owner))
  // Later owners unwind first. Retained overlapping owners must not lose their route.
  for (const owner of Object.keys(journal).reverse()) {
    if (owners.has(owner)) continue
    for (const [id, fields] of Object.entries(journal[owner]!)) {
      for (const [field, change] of Object.entries(fields)) {
        const current = fieldOf(configOf(document, id), field)
        if (isDeepStrictEqual(current, change.after)) writeField(document, id, field, change.before, change.hadConfig)
        else conflicts.push(`${owner}: ${id}.${field} changed outside the bundle; retained`)
      }
    }
    delete journal[owner]
  }
  for (const { owner, effects } of active) {
    if (Object.hasOwn(journal, owner) || effects.length === 0) continue
    const rows: Record<string, Record<string, Change>> = {}
    for (const effect of effects) {
      if (!record(effect) || typeof effect.id !== 'string' || effect.id.length === 0
        || (effect.set !== undefined && (!record(effect.set) || !Object.values(effect.set).every(item => item === null || typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)))))
        || (effect.track !== undefined && (!Array.isArray(effect.track) || !effect.track.every(field => typeof field === 'string' && field.length > 0)))) {
        throw new Error(`Invalid config effects for ${owner}`)
      }
      if (rows[effect.id] !== undefined) throw new Error(`Duplicate config effect row ${effect.id}`)
      const base = inherited.get(effect.id)
      if (base === undefined) throw new Error(`Config effect target "${effect.id}" is absent`)
      const hadConfig = rowIndex(document, effect.id) >= 0
      const before = configOf(document, effect.id)
      const fields: Record<string, Change> = {}
      const writes = effect.set === undefined ? {} : { ...(rowIndex(document, effect.id) < 0 ? base : before), ...effect.set }
      for (const field of new Set([...Object.keys(writes), ...effect.track ?? []])) {
        if (field === '__proto__' || field === 'constructor' || field === 'prototype') throw new Error('Reserved config effect field')
        for (const [other, ownedRows] of Object.entries(journal)) {
          if (Object.hasOwn(ownedRows[effect.id] ?? {}, field)) throw new Error(`${owner} and ${other} both manage ${effect.id}.${field}`)
        }
        fields[field] = { hadConfig, track: effect.track?.includes(field) === true, before: fieldOf(before, field), after: Object.hasOwn(writes, field) ? { present: true, value: writes[field] } : fieldOf(before, field) }
        if (Object.hasOwn(writes, field)) writeField(document, effect.id, field, fields[field]!.after)
      }
      rows[effect.id] = fields
    }
    journal[owner] = rows
  }
  saveJournal(document, journal)
  return conflicts
}

/** Update an owner's last writes after a settings/config-editor mutation.
 * Manual changes which already differ from the last write are left unclaimed.
 * @param document Updated profile document.
 * @param id Edited loader row.
 * @param before Raw profile config immediately before this write.
 */
export function recordConfigEffectWrite(document: Document, id: string, before: Record<string, unknown>): void {
  const journal = journalOf(document)
  const after = configOf(document, id)
  for (const rows of Object.values(journal).reverse()) {
    const fields = rows[id]
    if (fields === undefined) continue
    for (const [field, change] of Object.entries(fields)) {
      if (change.track && isDeepStrictEqual(fieldOf(before, field), change.after)) change.after = fieldOf(after, field)
    }
  }
  saveJournal(document, journal)
}
