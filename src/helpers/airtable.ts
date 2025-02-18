import Airtable from "airtable"
import { AirtableTs } from "airtable-ts";

import { componentsTable } from "@/lib/schema";

export const getAirtableDb = (): AirtableTs => {
  // NB. your AIRTABLE_API_KEY should be a PAT, but is referred to as an API key throughout the docs/code
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("AIRTABLE_API_KEY is not defined");
  }
  return new AirtableTs({
    apiKey: process.env.AIRTABLE_API_KEY,
  })
}

// airtable-ts provides a much nicer interface, but has limited capabilities, so in some cases we use the original SDK
export const getRawAirtableBase = (baseId: string | undefined = ""): Airtable.Base => {
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("AIRTABLE_API_KEY is not defined");
  }
  if (!baseId) {
    // if no base ID provided, assume we want the base containing the main 'Components' table
    baseId = componentsTable.baseId
  }
  return new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(baseId)
}

// FIXME: this function does not reliably return correct record ID!
export const getRecordIdByField = async (
  tableId: string,
  fieldId: string,
  value: string | number,
  baseId: string | undefined = undefined,
): Promise<string> => {
  console.debug(`Searching for record in table ${tableId} with field ${fieldId} matching ${value}`)
  const base = getRawAirtableBase(baseId)
  const table = base(tableId)
  const data = await table.select({
    filterByFormula: `"{${fieldId}} = ${value}"`,
    maxRecords: 1,
  }).firstPage()
  if (!data) {
    throw new Error(`No record found in table ${tableId} with field ${fieldId} matching ${value}`)
  }
  return data[0].id
}