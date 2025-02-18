import { getAirtableDb } from "@/helpers/airtable"
import { componentsTable, OrderBaseTable, Component, OrderBase } from "@/lib/schema"
import { ComponentStatus } from "@/lib/definitions"
import { getComponentStatusEnum } from "@/helpers/utils"

const COMPONENT_STATUSES_TO_IGNORE = new Set([
  ComponentStatus.Feasibility,
  ComponentStatus.DesignInProgress,
])

// by using PUT we indicate that this route is idempotent (i.e. can be run freely without side effects)
export async function PUT() {
  try {
    const db = getAirtableDb()
    const orders: OrderBase[] = await db.scan(OrderBaseTable)

    let ordersSynced = 0, ordersIgnored = 0, recordsCreated = 0;
    for (const order of orders) {
      if (order.isSynced) { 
        console.debug(`Order ${order.orderRef} (${order.id}) is already synced`);
        continue;
      }
      // get component status enum from order status (brittle, but ok for now)
      const status: ComponentStatus = getComponentStatusEnum(order.status)
      if (COMPONENT_STATUSES_TO_IGNORE.has(status)) {
        console.debug(`Ignoring order ${order.orderRef} with status ${status}`)
        ordersIgnored++;
        continue;
      }
      console.debug(`Syncing order ${order.orderRef} (${order.id}) with status ${status}`);
      // grab essential data from Order base record to populate new record(s) in Components table
      // NB. most fields in Components are lookups to Order base, so don't need to be included here
      const newRecordData: Partial<Component> = {
        componentName: order.componentName,
        orderBase: [ order.id ],
        status: order.status,
      }
      // create the new record(s)
      for (let i = 0; i < order.quantity; i++) {
        let newComponentRecord = await db.insert(componentsTable, newRecordData);
        recordsCreated++;
        console.debug(`Record ${i + 1} of ${order.quantity} created with ID: ${newComponentRecord.id}`);
        console.log(newComponentRecord)
      }
      ordersSynced++;
      console.log(`Successfully created ${order.quantity} new component records from order ${order.orderRef}`);
    }
    console.log(`Successfully synced ${ordersSynced} orders, creating ${recordsCreated} new component records`);
    console.debug(`Ignored ${ordersIgnored} orders due to them not yet being '${ComponentStatus.ReadyForProduction}' or later in their lifecycle`);

    // response status code should indicate whether anything was actually created
    if (ordersSynced > 0) {
      return Response.json(
        { message: `Synced ${ordersSynced} orders from ${OrderBaseTable.name} to ${componentsTable.name} table` },
        { status: 201 },
      );
    } else {
      return Response.json(
        { message: `No action: ${OrderBaseTable.name} is already synced with ${componentsTable.name} table` },
        { status: 204 },
      );
    }
  } catch (error) {
    console.error(`Failed to sync orders in ${OrderBaseTable.name} to ${componentsTable.name} table:`, error);
    return Response.json(
        { error: `Failed to synchronise ${OrderBaseTable.name} with ${componentsTable.name} table` },
        { status: 500 },
    );
  }
}

 
