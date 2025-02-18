import { Suspense } from "react";

import { getAirtableDb, getRecordIdByField } from "@/helpers/airtable";
import { componentsTable, type Component } from "@/lib/schema"
import { LoadingSpinner } from "@/components/LoadingSpinner";

// TODO: use ISR to update static passport pages on Airtable changes??
// indicate that pages which fail to generate at build should be fetched at request time
export const dynamicParams = true

// this runs once, at build time, to prepare static pages for every component
export async function generateStaticParams() {
  const db = getAirtableDb()
  const components: Component[] = await db.scan(componentsTable)
  return components.map((component) => ({
    uid: component.componentUID,
  }))
}

export default async function Page({
  params,
}: {
  params: Promise<{
    uid: string,
  }>
}) {
  const { uid } = await params
  if (!componentsTable.mappings) {
    throw new Error(`No mappings found for ${componentsTable.name} table - cannot reference UID field to fetch record`)
  }
  
  // TODO: reduce airtable requests by passing record ID down from request in generateStaticParams (e.g. concat?)
  const recordId = await getRecordIdByField(componentsTable.tableId, componentsTable.mappings.componentUID, uid)
  const db = getAirtableDb()

  let component: Component
  try {
    component = await db.get(componentsTable, recordId)
    console.debug(`Fetched component ${component.componentUID} from Airtable`)
  } catch (error) {
    console.error("Error fetching component", error)
    return <p>Error fetching component</p>
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <h1>COMPONENT PASSPORT</h1>
      <p>Custom Component UID from params (should match URL): {uid}</p>
      <p>Component UID from fetched component (should be same): {String(component.componentUID)}</p>
      <p>Whole component from Airtable: {JSON.stringify(component)}</p>
    </ Suspense>
  );
}
