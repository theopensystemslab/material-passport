import { PassThrough } from 'stream'

import 'server-only'
import { put } from '@vercel/blob'
import { isNotNil } from 'es-toolkit'
import { type NextRequest, NextResponse } from 'next/server'

import { getRawAirtableBase, getRecordByField } from '@/lib/airtable'
import { writePdfToStream } from '@/lib/pdf'
import { type Component, componentsTable } from '@/lib/schema'

const PDF_BLOB_FOLDER = 'pdf'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

// backup util endpoint to generate (and return) pdf for a given component if sync-orders script failed to do so
export const GET = async (req: NextRequest): Promise<NextResponse> => {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const searchParams = req.nextUrl.searchParams
  const uid = searchParams.get('uid')
  if (!uid) {
    return new NextResponse('No component UID supplied in request (i.e. "uid=xxx")', { status: 400 })
  }
  
  try {
    const component = await getRecordByField<Component>(
      componentsTable,
      componentsTable.mappings?.componentUid,
      uid,
      { shouldThrow: true },
    )
    if (!component) {
      return new NextResponse(`Failed to fetch component with UID ${uid}`, { status: 409 })
    }
    if (isNotNil(component.label) && component.label.length > 0) {
      return new NextResponse(`Label pdf already exists in Airtable for component ${uid}`, { status: 500 })
    }
    
    console.debug(`Attempting to generate pdf for component ${uid}`)
    const duplexMemoryStream = new PassThrough()
    const result = await writePdfToStream(duplexMemoryStream, component)
    if (!result) {
      return new NextResponse('Failed to generate pdf', { status: 500 })
    }
    console.debug('Successfully generated pdf - uploading to Airtable')
    const blob = await put(`${PDF_BLOB_FOLDER}/${uid}.pdf`, duplexMemoryStream, {
      access: 'public',
    })
    const table = getRawAirtableBase()(componentsTable.tableId)
    // @ts-expect-error (as in sync-orders)
    table.update(component.id, {
      'Label': [{
        'url': blob.url,
      }]})

    return new NextResponse('Generated pdf', { status: 201 })
  } catch (error) {
    const msg = `Failed to generate pdf for component ${uid}`
    console.error(msg, error)
    return new NextResponse(msg, { status: 500 })
  }
}
