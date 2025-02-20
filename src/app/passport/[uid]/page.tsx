import { unstable_cache as cache } from "next/cache"
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getAirtableDb,
  getRecordIdByField,
  scanTable,
} from "@/helpers/airtable";
import { componentsTable, type Component } from "@/lib/schema";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { isNotNil } from "es-toolkit";

// we use ISR to generate static passports at build and fetch fresh data at request time as needed
export const revalidate = 60;

// we cache the scan to reduce requests to Airtable's API and avoid being throttled at build time
const getCachedTable = cache(scanTable, [], { revalidate: 60 });

// this runs once, at build time, to prepare static pages for every component
export async function generateStaticParams(): Promise<{ uid: string }[]> {
  const components = (await getCachedTable(componentsTable)) as Component[];
  // ignore any records without UID (none should exist anyway)
  return components
    .filter((component) => isNotNil(component.componentUID))
    .map((component) => ({ uid: component.componentUID as string }));
}

export default async function Page({
  params,
}: {
  params: Promise<{
    uid: string;
  }>;
}) {
  const { uid } = await params;

  let component: Component | undefined;
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    // if generating at build time, use cached scan of components table
    const components = (await getCachedTable(componentsTable)) as Component[];
    component = components.find((component) => component.componentUID === uid);
    if (component === undefined) {
      console.warn(`No component with UID ${uid} found in table:`);
      notFound();
    }
    console.debug(`Found component ${uid} in full table data`);
  } else {
    try {
      const db = getAirtableDb();
      if (!componentsTable.mappings) {
        throw new Error(
          `No mappings found for ${componentsTable.name} table - cannot reference UID field to fetch record`
        );
      }
      const recordId = await getRecordIdByField(
        componentsTable.tableId,
        componentsTable.mappings.componentUID,
        uid
      );
      if (!recordId) {
        throw new Error(`Failed to fetch record ID for component ${uid}`);
      }
      console.debug(`Fetched record ID ${recordId} for component ${uid}`);
      component = await db.get(componentsTable, recordId);
      if (!component) {
        throw new Error(
          `Failed to fetch component ${uid} with record ID ${recordId}`
        );
      }
      console.debug(
        `Fetched component ${component.componentUID} from Airtable`
      );
      if (component.componentUID !== uid) {
        throw new Error(
          `Fetched wrong record: ${component.componentUID} != ${uid}`
        );
      }
    } catch (error) {
      console.error(`Error fetching component ${uid}:`, error);
      notFound();
    }
  }

  // final type guard to ensure component is defined
  if (!component) {
    console.error(`No component found for UID: ${uid}`);
    notFound();
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <h1>COMPONENT PASSPORT</h1>
      <p>Custom Component UID from params (should match URL): {uid}</p>
      <p>
        Component UID from fetched component (should be same):{" "}
        {String(component.componentUID)}
      </p>
      <p>Whole component from Airtable: {JSON.stringify(component)}</p>
    </Suspense>
  );
}
