import 'server-only'
import { PassThrough } from 'stream'

import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

import { getAirtableDb, getRawAirtableBase } from '@/lib/airtable'
import { ComponentStatus } from '@/lib/definitions'
import { writePdfToStream } from '@/lib/pdf'
import { generateQrDataImage, generateQrPngStream } from '@/lib/qrcode'
import {
  type OrderBase,
  componentsTable,
  orderBaseTable,
} from '@/lib/schema'
import { getComponentStatusEnum } from '@/lib/utils'

const MATERIAL_PASSPORT_DOMAIN = 'wikihouse.materialpassport.info'
const QR_CODE_BLOB_FOLDER = 'qr-code'
const PDF_BLOB_FOLDER = 'pdf'

// nodejs is the default runtime (alternative being 'edge'), but we declare it explicitly for clarity
export const runtime = 'nodejs'
// allow function to run to completion (default is 15 on Pro acct, max is 300)
export const maxDuration = 240
// ensure that this route is not cached
export const dynamic = 'force-dynamic'

const COMPONENT_STATUSES_TO_IGNORE = new Set([
  ComponentStatus.DesignInProgress,
])

// FIXME: remove pdf generation logic until it can be made to work in production
// route has to be GET to be triggerable by the cron job (POST/PUT would be more appropriate)
export const GET = async (req: NextRequest): Promise<NextResponse> => {
  // guard against unauthorised triggering of this hook
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  try {
    const db = getAirtableDb()
    const orders: OrderBase[] = await db.scan(orderBaseTable)

    // TODO: keep track of blobs and clean up store at end of run (https://vercel.com/docs/vercel-blob/using-blob-sdk#del)
    let ordersSynced = 0, ordersIgnored = 0, recordsCreated = 0
    for (const order of orders) {
      if (order.isSynced) { 
        console.debug(`Order ${order.orderRef} (${order.id}) is already synced`)
        continue
      }
      // get component status enum from order status (brittle, but ok for now)
      const status: ComponentStatus = getComponentStatusEnum(order.status)
      if (COMPONENT_STATUSES_TO_IGNORE.has(status)) {
        console.debug(`Ignoring order ${order.orderRef} with status ${status}`)
        ordersIgnored++
        continue
      }
      console.debug(`Syncing order ${order.orderRef} (${order.id}) with status ${status}`)
      
      // create the new record(s)
      for (let i = 0; i < order.quantity; i++) {
        // grab id and status from Order base record to populate new record(s)
        // NB. most fields in 'Components' are lookups to 'Order base', so don't need to be included here
        const newComponentRecord = await db.insert(componentsTable, {
          orderBase: [ order.id ],
          status: order.status,
        })
        console.debug(`Record ${i + 1} of ${order.quantity} created with ID: ${newComponentRecord.id}`)
        // now get the UID, fix the (permanent) URI of the passport, encode it in a QR, build the label, and update the new record accordingly 
        const uid = newComponentRecord.componentUid
        const passportUri = `${MATERIAL_PASSPORT_DOMAIN}/passport/${uid}`
        const qrDataImage = await generateQrDataImage(passportUri)
        // we dump QR as png to our dedicated Vercel blob store via in-memory stream, for immediate upload to airtable (which requires a public URL)
        const qrDuplexMemoryStream = new PassThrough()
        await generateQrPngStream(qrDuplexMemoryStream, passportUri)
        const qrBlob = await put(`${QR_CODE_BLOB_FOLDER}/${uid}.png`, qrDuplexMemoryStream, {
          access: 'public',
        })
        console.debug(`QR code for component ${uid} uploaded to blob store: ${qrBlob.url}`)
        // we take a similar approach for generating the pdf label, passing the newly generated QR code as png data image
        const pdfDuplexMemoryStream = new PassThrough()
        await writePdfToStream(pdfDuplexMemoryStream, newComponentRecord, qrDataImage)
        const pdfBlob = await put(`${PDF_BLOB_FOLDER}/${uid}.pdf`, pdfDuplexMemoryStream, {
          access: 'public',
        })
        console.debug(`PDF for component ${uid} uploaded to blob store: ${pdfBlob.url}`)
        // airtable-ts considers the qrCodePng field (of type Attachment) as readonly, so we use the classic SDK for this update
        const table = getRawAirtableBase()(componentsTable.tableId)
        // @ts-expect-error: providing a full Attachment object triggers an INVALID_ATTACHMENT_OBJECT (422) error from the Airtable API, but a URL suffices 
        table.update(newComponentRecord.id, {
          'QR code (png)': [{
            'url': qrBlob.url,
          }],
          'QR code (base64)': qrDataImage,
          'Passport': passportUri,
          'Label': [{
            'url': pdfBlob.url,
          }],
        })
        console.debug(`Record ${newComponentRecord.id} with UID ${uid} updated with label URI and QR code (png and base64)`)
        recordsCreated++
      }

      // finally, mark the order as synced to avoid duplicating records on next run
      await db.update(orderBaseTable, { id: order.id, isSynced: true })
      console.log(`Successfully created ${order.quantity} new component records from order ${order.orderRef}`)
      ordersSynced++
    }

    console.log(`Successfully synced ${ordersSynced} orders, creating ${recordsCreated} new component records`)
    console.debug(`Ignored ${ordersIgnored} orders due to being earlier than '${ComponentStatus.ReadyForProduction}' in lifecycle`)
    // response status code should indicate whether anything was actually created (201) or not (204)
    if (ordersSynced > 0) {
      return NextResponse.json(
        { message: `Synced ${ordersSynced} orders from ${orderBaseTable.name} to ${componentsTable.name} table` },
        { status: 201 },
      )
    } else {
      return new NextResponse(null, { status: 204 })
    }
  } catch (error) {
    console.error(`Failed to sync orders in ${orderBaseTable.name} to ${componentsTable.name} table:`, error)
    return NextResponse.json(
      { error: `Failed to synchronise ${orderBaseTable.name} with ${componentsTable.name} table` },
      { status: 500 },
    )
  }
}
