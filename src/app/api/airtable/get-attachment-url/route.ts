import { NextRequest, NextResponse } from 'next/server'

import {
  getFieldNameForUnknownTable,
  getRecordById,
  tableByTableIdLookup,
} from '@/lib/airtable'
import { AIRTABLE_ATTACHMENT_CACHE_SECONDS } from '@/lib/definitions'

export const GET = async (req: NextRequest): Promise<NextResponse> => {
  const searchParams = req.nextUrl.searchParams
  const tableId = searchParams.get('tableId')
  const recordId = searchParams.get('recordId')
  const fieldId = searchParams.get('fieldId')
  if (!(tableId && recordId && fieldId)) {
    const msg = 'Request does not include all expected query params'
    console.error(msg)
    return new NextResponse(msg, { status: 500 })
  }
  console.debug(`Received request for field ${fieldId} of record ${recordId} of table ${tableId}`)
  
  try {    
    const table = tableByTableIdLookup[tableId]
    if (!table) throw new Error(`No table found with ID ${tableId}`)

    const record = await getRecordById(table, recordId)
    if (!record) throw new Error(`No record with ID ${recordId} found in table ${table.name}`)

    const fieldName = getFieldNameForUnknownTable(table, fieldId)
    if (!fieldName) throw new Error(`No field with ID ${fieldId} found for table ${table.name}`)
      
    const attachment = record[fieldName]
    if (!attachment?.[0]) {
      throw new Error(`No attachment found for field ${fieldName} of record ${recordId} in table ${table.name}`)
    }
      
    console.debug(`Returning attachment for field ${fieldName} of table ${table.name}`)
    // set cache control headers (should match SWR client-side cache in AirtableImage component)
    return new NextResponse(attachment[0], { 
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${AIRTABLE_ATTACHMENT_CACHE_SECONDS}, s-maxage=${AIRTABLE_ATTACHMENT_CACHE_SECONDS}`,
        'Content-Type': 'text/plain'
      } 
    })
  } catch (error) {
    const msg = 'Failed to fetch fresh attachment URL from Airtable'
    console.error(msg, error)
    return new NextResponse(msg, { status: 500 })
  }
}
