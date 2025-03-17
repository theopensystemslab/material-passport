import 'server-only'
import Airtable from 'airtable'
import {
  AirtableTs,
  type Item,
  type Table,
} from 'airtable-ts'
import { isNil, isNotNil } from 'es-toolkit'
import { memoize } from 'es-toolkit/function'
import { unstable_cache as cache } from 'next/cache'

import type {
  Nil,
  ReversedTableMapping,
  TableMapping,
  TableMappingKeys,
  ValueOf,
} from '@/lib/definitions'
import { componentsTable } from '@/lib/schema'

const DEFAULT_TABLE_REVALIDATION_PERIOD_SECONDS = 900

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

// we provide a factory to return cached table scans to reduce requests to Airtable's API and avoid being throttled
export const getCachedScan = <I extends Item>(
  table: Table<I>,
  revalidationSeconds: number = DEFAULT_TABLE_REVALIDATION_PERIOD_SECONDS,
): () => Promise<I[]> => {
  return cache(
    async (): Promise<I[]> => scanTable(table),
    [table.name], // use table name as cache key (and cache tag), since actual table arg is closed over
    {
      tags: [table.name],
      revalidate: revalidationSeconds,
    },
  )
}

interface GetRecordOptions {
  shouldThrow?: boolean
}

// we will generally use a reversed table mapping to get field names to pass in here (unless searching directly on record ID)
export const getRecordFromScan = async <I extends Item>(
  cachedScan: ReturnType<typeof getCachedScan<I>>,
  value: ValueOf<I>,
  fieldNameToMatch: keyof I | 'id' | Nil = 'id',
  { shouldThrow = false }: GetRecordOptions = {},
): Promise<I | null> => {
  if (isNil(fieldNameToMatch)) {
    const msg = 'No field name passed'
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  const records = await cachedScan()
  const record = records.find((record) => record[fieldNameToMatch] === value)
  if (isNil(record)) {
    const msg = `No record with field ${String(fieldNameToMatch)} having value ${value} found in table`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  console.debug(`Found record with field ${String(fieldNameToMatch)} having value ${value} in table`)
  return record
}

export const getRecordsFromScan = async <I extends Item>(
  cachedScan: ReturnType<typeof getCachedScan<I>>,
  values: ValueOf<I>[],
  fieldNameToMatch: keyof I | 'id' | Nil = 'id',
  { shouldThrow = false }: GetRecordOptions = {},
): Promise<I[]> => {
  const records = []
  for (const value of values) {
    const record = await getRecordFromScan(cachedScan, value, fieldNameToMatch, { shouldThrow })
    if (isNotNil(record)) records.push(record)
  }
  return records
}

export const getRecordById = async <I extends Item>(
  table: Table<I>,
  recordId: string,
  { shouldThrow = false }: GetRecordOptions = {},
): Promise<I | null> => {
  const db = getAirtableDb()
  console.debug(`Fetching record ${recordId} from table ${table.name}`)
  const record = await db.get(table, recordId)
  if (!record) {
    const msg = `No record found in table ${table.name} with ID: ${recordId}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  return record
}

export const getRecordsById = async <I extends Item>(
  table: Table<I>,
  recordIds: string[],
  { shouldThrow = false }: GetRecordOptions = {},
): Promise<I[]> => {
  const records = []
  for (const recordId of recordIds) {
    const record = await getRecordById<I>(table, recordId, { shouldThrow })
    if (isNotNil(record)) records.push(record)
  }
  return records
}

// when using the 'raw' SDK, we can't rely on a table from our schema to provide the base ID, so we allow it to be passed
interface rawGetRecordOptions {
  shouldThrow?: boolean
  baseId?: string
}

export const getRecordIdByField = async (
  tableId: string,
  fieldId: string,
  value: string | number,
  { shouldThrow = false, baseId = undefined }: rawGetRecordOptions = {},
): Promise<string | null> => {
  const table = getRawAirtableBase(baseId)(tableId)
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
    return null
  }
  return data[0].id
}

export const getRecordByField = async <I extends Item>(
  table: Table<I>,
  fieldId: string | undefined,
  value: string | number,
  { shouldThrow = false, baseId = undefined }: rawGetRecordOptions = {},
): Promise<I | null> => {
  const db = getAirtableDb()
  if (!table.mappings) {
    const msg = `No mappings found for ${table.name} table - cannot reference field ${String(fieldId)}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  if (!fieldId) {
    const msg = 'No field ID given'
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  const recordId = await getRecordIdByField(
    componentsTable.tableId,
    fieldId,
    value,
    { shouldThrow, baseId },
  )
  // if no record ID returned, error and logging is already handlded in func, so simply return null
  if (!recordId) return null
  const record = await db.get(table, recordId)
  if (!record) {
    const msg = `Failed to fetch record with ID ${recordId}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  console.debug(
    `Fetched record from table ${table.name} with value of field ${fieldId} matching ${value}`
  )
  return record
}

export const getRecordsByField = async <I extends Item>(
  table: Table<I>,
  fieldId: string | undefined,
  values: string[] | number[],
  { shouldThrow = false, baseId = undefined }: rawGetRecordOptions = {},
): Promise<I[]> => {
  const records = []
  for (const value of values) {
    const record = await getRecordByField<I>(table, fieldId, value, { shouldThrow, baseId })
    if (isNotNil(record)) records.push(record)
  }
  return records
}


// we can use the mapping returned here to get field names from field IDs, which are less liable to change
export const getReversedTableMapping = <T extends Table<I>, I extends Item>(
  table: T,
): ReversedTableMapping<I> | null => {
  if (!table.mappings) {
    console.warn(`No mappings found for ${table.name} table - cannot generate reverse mappings`)
    return null
  }
  const mappings = table.mappings as TableMapping<I>
  const reversedMapping = {} as ReversedTableMapping<I>
  for (const [k, v] of Object.entries(mappings)) {
    reversedMapping[v as string] = k as TableMappingKeys<I>
  }
  return reversedMapping
}

export const getFieldNameByFieldId = <I extends Item>(
  table: Table<I>,
  fieldId: string | Nil,
): TableMappingKeys<I> | null => {
  if (isNil(fieldId)) {
    console.warn('No field ID passed')
    return null
  }
  const reversedMapping = getReversedTableMapping(table)
  const fieldName = reversedMapping?.[fieldId]
  if (isNil(fieldName)) {
    console.warn(`No field name found for ID ${fieldId} in table ${table.name}`)
    return null
  }
  console.debug(`Field name for ID ${fieldId} in table ${table.name} is ${fieldName}`)
  return fieldName as TableMappingKeys<I>
}

// we provide a factory for getting memoized field name lookups, to reduce repeated computations
// this works because field IDs are unique and schema is static in repo
export const getFieldNameMemoized = <I extends Item>(
  table: Table<I>,
) => {
  // memoizer can only take functions with 0 or 1 args, so we close over given table
  return memoize((fieldId: string | Nil) => getFieldNameByFieldId(table, fieldId))
}
