import 'server-only'
import { type NextRequest, NextResponse } from 'next/server'

import { getAirtableDb } from '@/helpers/airtable'
import { ComponentStatus } from '@/lib/definitions'
import {
  type Component,
  type OrderBase,
  componentsTable,
  orderBaseTable,
} from '@/lib/schema'
import { getComponentStatusEnum } from '@/lib/utils'

// allow function 120s to run to completion (default is 15 on Pro acct, max is 300)
export const maxDuration = 120
// ensure that this route is not cached
export const dynamic = 'force-dynamic'

const COMPONENT_STATUSES_TO_IGNORE = new Set([
  ComponentStatus.DesignInProgress,
])

// route has to be GET to be triggerable the cron job (POST/PUT would be more appropriate)
export async function GET(req: NextRequest): Promise<Response> {
  // guard against unauthorised triggering of this hook
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  try {
    const db = getAirtableDb()
    const orders: OrderBase[] = await db.scan(orderBaseTable)

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
      // grab id and status from Order base record to populate new record(s) in Components table
      // NB. most fields in Components are lookups to Order base, so don't need to be included here
      const newRecordData: Partial<Component> = {
        orderBase: [ order.id ],
        status: order.status,
      }
      // create the new record(s)
      for (let i = 0; i < order.quantity; i++) {
        const newComponentRecord = await db.insert(componentsTable, newRecordData)
        console.debug(`Record ${i + 1} of ${order.quantity} created with ID: ${newComponentRecord.id}`)
        recordsCreated++
      }
      // finally, mark the order as synced to avoid duplicating records on next run
      await db.update(orderBaseTable, { id: order.id, isSynced: true })
      console.log(`Successfully created ${order.quantity} new component records from order ${order.orderRef}`)
      ordersSynced++
    }
    console.log(`Successfully synced ${ordersSynced} orders, creating ${recordsCreated} new component records`)
    console.debug(`Ignored ${ordersIgnored} orders due to being earlier than '${ComponentStatus.ReadyForProduction}' in lifecycle`)

    // response status code should indicate whether anything was actually created
    if (ordersSynced > 0) {
      return NextResponse.json(
        { message: `Synced ${ordersSynced} orders from ${orderBaseTable.name} to ${componentsTable.name} table` },
        { status: 201 },
      )
    } else {
      return NextResponse.json(
        { message: `No action: ${orderBaseTable.name} is already synced with ${componentsTable.name} table` },
        { status: 204 },
      )
    }
  } catch (error) {
    console.error(`Failed to sync orders in ${orderBaseTable.name} to ${componentsTable.name} table:`, error)
    return NextResponse.json(
      { error: `Failed to synchronise ${orderBaseTable.name} with ${componentsTable.name} table` },
      { status: 500 },
    )
  }
}

 
