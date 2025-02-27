import 'server-only'
import Airtable from 'airtable'
import {
  AirtableTs,
  Item,
  Table
} from 'airtable-ts'
import { isNil } from 'es-toolkit'

import { componentsTable } from '@/lib/schema'

export const getAirtableDb = (): AirtableTs => {
  // NB. your AIRTABLE_API_KEY should be a PAT, but is referred to as an API key throughout the docs/code
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error('AIRTABLE_API_KEY is not defined')
  }
  return new AirtableTs({
    apiKey: process.env.AIRTABLE_API_KEY,
  })
}

// airtable-ts provides a much nicer interface, but has limited capabilities, so in some cases we use the original SDK
export const getRawAirtableBase = (baseId: string | undefined = undefined): Airtable.Base => {
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error('AIRTABLE_API_KEY is not defined')
  }
  // if no base ID supplied, we check the env, or else default to the base containing the main 'Components' table
  baseId = baseId || process.env.AIRTABLE_BASE_ID || componentsTable.baseId
  return new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(baseId)
}

export const scanTable = async (table: Table<Item>): Promise<Item[]> => {
  const db = getAirtableDb()
  console.debug(`Scanning table: ${table.name}`)
  return await db.scan(table)
}

interface GetRecordOptions {
  shouldThrow?: boolean
}

export const getRecordById = async (
  table: Table<Item>,
  recordId: string,
  { shouldThrow = false }: GetRecordOptions = {},
): Promise<Item | undefined> => {
  const db = getAirtableDb()
  console.debug(`Fetching record ${recordId} from table ${table.name}`)
  const record = await db.get(table, recordId)
  if (!record) {
    const msg = `No record found in table ${table.name} with ID: ${recordId}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return
  }
  return record
}

interface rawGetRecordOptions {
  shouldThrow?: boolean
  baseId?: string
}

export const getRecordIdByField = async (
  tableId: string,
  fieldId: string,
  value: string | number,
  { shouldThrow = false, baseId = undefined }: rawGetRecordOptions = {},
): Promise<string | undefined> => {
  const base = getRawAirtableBase(baseId)
  const table = base(tableId)
  console.debug(`Searching for record in table ${tableId} with field ${fieldId} matching ${value}`)
  const formula = `{${fieldId}} = '${value}'`
  console.debug(`Arranging formula: ${formula}`)
  const data = await table.select({
    filterByFormula: formula,
    maxRecords: 1,
  }).firstPage()
  if (isNil(data) || data.length === 0) {
    const msg = `No record found in table ${tableId} with field ${fieldId} matching ${value}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return
  }
  return data[0].id
}

export const getRecordByField = async <T extends Item>(
  table: Table<T>,
  fieldMapping: keyof Omit<T, 'id'>,
  value: string | number,
  { shouldThrow = false, baseId = undefined }: rawGetRecordOptions = {},
): Promise<T | undefined> => {
  const db = getAirtableDb()
  if (!table.mappings) {
    const msg = `No mappings found for ${table.name} table - cannot reference field ${String(fieldMapping)}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return
  }
  // in practice the field ID is always a string (see schema.ts), but we ensure for type safety
  const fieldId = getFieldId(table.mappings[fieldMapping])
  const actualFieldId = Array.isArray(fieldId) ? fieldId[0] : fieldId
  const recordId = await getRecordIdByField(
    componentsTable.tableId,
    actualFieldId,
    value,
    { shouldThrow, baseId },
  )
  if (!recordId) return
  const record = await db.get(table, recordId)
  if (!record) {
    const msg = `Failed to fetch record with ID ${recordId}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return
  }
  console.debug(
    `Fetched record from table ${table.name} with field ${String(fieldMapping)} matching ${value}`
  )
  return record
}

const getFieldId = (fieldId: string | string[] | undefined): string => {
  if (!fieldId) {
    throw new Error('No field ID for given mapping found in table')
  }
  if (Array.isArray(fieldId)) {
    if (fieldId.length === 0) {
      throw new Error('Field ID array is empty')
    }
    return fieldId[0]
  }
  return fieldId
}
