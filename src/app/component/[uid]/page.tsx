import { getAirtableDb, getRecordIdByField } from "@/helpers/airtable";
import { componentsTable, type Component } from "@/lib/schema"

// indicate that pages not generated at build/on revalidation, will not be fetched at runtime (i.e. will return 404)
export const dynamicParams = false
// use an ISR approach for component passports (revalidating every minute)
export const revalidate = 60

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
  const recordId = await getRecordIdByField(componentsTable.tableId, componentsTable.mappings.componentUID, uid)
  const db = getAirtableDb()
  const component: Component = await db.get(componentsTable, recordId)
  console.log("COMPONENT", component)

  return (
    <>
      <h1>COMPONENT PASSPORT</h1>
      <p>Custom Component UID from params (should match URL): {uid}</p>
      <p>Component UID from fetched component (should be same): {String(component.componentUID)}</p>
      <p>Whole component from Airtable: {JSON.stringify(component)}</p>
    </>
  );
}
