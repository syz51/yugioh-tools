import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { analysisSelectionConfig } from '../../../db/schema'
import { parseAnalysisSelectionState } from './analysis-selection-state'
import type { PersistedAnalysisSelectionConfig } from '../types'

export async function getPersistedAnalysisSelectionConfig({
  analysisId,
  cfg,
}: {
  analysisId: string
  cfg: string
}) {
  const lookupResult = await findAnalysisSelectionConfigByCfg(cfg)
  const row = lookupResult.schemaUnavailable ? null : lookupResult.row

  if (!row || row.analysisId !== analysisId) {
    return null
  }

  return serializeAnalysisSelectionConfig(row)
}

export async function upsertPersistedAnalysisSelectionConfig({
  analysisId,
  cfg,
  state,
}: {
  analysisId: string
  cfg: string
  state: unknown
}) {
  const payload = parseAnalysisSelectionState(state)

  if (!payload) {
    throw new Error('Invalid analysis selection state')
  }

  const now = new Date()
  const lookupResult = await findAnalysisSelectionConfigByCfg(cfg)

  if (lookupResult.schemaUnavailable) {
    return { ok: true as const }
  }

  const existingRow = lookupResult.row

  if (!existingRow) {
    try {
      await db.insert(analysisSelectionConfig).values({
        cfg,
        analysisId,
        payload,
        createdAt: now,
        updatedAt: now,
      })
    } catch (error) {
      if (isSelectionConfigSchemaUnavailableError(error)) {
        return { ok: true as const }
      }

      throw error
    }

    return { ok: true as const }
  }

  if (existingRow.analysisId !== analysisId) {
    return { ok: true as const }
  }

  try {
    await db
      .update(analysisSelectionConfig)
      .set({
        payload,
        updatedAt: now,
      })
      .where(eq(analysisSelectionConfig.cfg, cfg))
  } catch (error) {
    if (isSelectionConfigSchemaUnavailableError(error)) {
      return { ok: true as const }
    }

    throw error
  }

  return { ok: true as const }
}

function serializeAnalysisSelectionConfig(
  row: typeof analysisSelectionConfig.$inferSelect,
): PersistedAnalysisSelectionConfig {
  return {
    cfg: row.cfg,
    analysisId: row.analysisId,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function findAnalysisSelectionConfigByCfg(cfg: string) {
  try {
    return {
      row: await db.query.analysisSelectionConfig.findFirst({
        where: eq(analysisSelectionConfig.cfg, cfg),
      }),
      schemaUnavailable: false as const,
    }
  } catch (error) {
    if (isSelectionConfigSchemaUnavailableError(error)) {
      return {
        row: null,
        schemaUnavailable: true as const,
      }
    }

    throw error
  }
}

function isSelectionConfigSchemaUnavailableError(error: unknown) {
  return findErrorCode(error, new Set(['42P01', '42703'])) !== null
}

function findErrorCode(error: unknown, codes: Set<string>) {
  let current: unknown = error
  const seen = new Set<unknown>()

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)

    if ('code' in current && typeof current.code === 'string') {
      if (codes.has(current.code)) {
        return current.code
      }
    }

    current = 'cause' in current ? current.cause : null
  }

  return null
}
