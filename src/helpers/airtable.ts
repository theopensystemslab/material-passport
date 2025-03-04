import 'server-only'
import Airtable from 'airtable'
import {
  AirtableTs,
  type Item,
  type Table,
} from 'airtable-ts'
import { isNil } from 'es-toolkit'

import {
  ItemKeys,
  ReversedTableMapping,
  TableMapping
} from '@/lib/definitions'
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

export const scanTable = async <I extends Item>(table: Table<I>): Promise<I[]> => {
  const db = getAirtableDb()
  console.debug(`Scanning table: ${table.name}`)
  return await db.scan(table)
}

interface GetRecordOptions {
  shouldThrow?: boolean
}

export const getRecordById = async <I extends Item>(
  table: Table<I>,
  recordId: string,
  { shouldThrow = false }: GetRecordOptions = {},
): Promise<I | undefined> => {
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

export const getRecordByField = async <I extends Item>(
  table: Table<I>,
  fieldId: string | undefined,
  value: string | number,
  { shouldThrow = false, baseId = undefined }: rawGetRecordOptions = {},
): Promise<I | undefined> => {
  const db = getAirtableDb()
  if (!table.mappings) {
    const msg = `No mappings found for ${table.name} table - cannot reference field ${String(fieldId)}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return
  }
  if (!fieldId) {
    const msg = 'No field ID given'
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return
  }
  const recordId = await getRecordIdByField(
    componentsTable.tableId,
    fieldId,
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
  const reversedMapping = getReversedTableMapping(table)
  const fieldName = reversedMapping?.[fieldId]
  console.debug(
    `Fetched record from table ${table.name} with value of field ${fieldName} matching ${value}`
  )
  return record
}

// we can use the mapping returned here to get field names from field IDs for a given table
export const getReversedTableMapping = 
  <T extends Table<I>, I extends Item>(table: T): ReversedTableMapping<I> | undefined => {
    if (!table.mappings) {
      console.warn(`No mappings found for ${table.name} table - cannot generate reverse mappings`)
      return
    }
    const mappings = table.mappings as TableMapping<I>
    const reversedMapping = {} as ReversedTableMapping<I>
    for (const [k, v] of Object.entries(mappings)) {
      reversedMapping[v as string] = k as ItemKeys<I>
    }

    return reversedMapping
  }
