import { isNotNil } from 'es-toolkit'
import { kebabCase } from 'es-toolkit/string'
import { MoveLeft } from 'lucide-react'
import { unstable_cache as cache } from 'next/cache'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  getAirtableDb,
  getRecordIdByField,
  scanTable,
} from '@/helpers/airtable'
import {
  type Component,
  Project,
  componentsTable,
  projectsTable
} from '@/lib/schema'

// we use ISR to generate static passports at build and fetch fresh data at request time as needed
export const revalidate = 60

// we cache the scan to reduce requests to Airtable's API and avoid being throttled at build time
const getCachedTable = cache(scanTable, [], { revalidate: 60 })

// this runs once, at build time, to prepare static pages for every component
export async function generateStaticParams(): Promise<{ uid: string }[]> {
  const components = (await getCachedTable(componentsTable)) as Component[]
  // ignore any records without UID (none should exist anyway)
  return components
    .filter((component) => isNotNil(component.componentUID))
    .map((component) => ({ uid: component.componentUID as string }))
}

export default async function Page({
  params,
}: {
  params: Promise<{
    uid: string;
  }>;
}) {
  const { uid } = await params

  const db = getAirtableDb()
  let component: Component | undefined
  let project: Project | undefined
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    // if generating at build time, use cached scan of components table
    const components = (await getCachedTable(componentsTable)) as Component[]
    component = components.find((component) => component.componentUID === uid)
    if (component === undefined) {
      console.warn(`No component with UID ${uid} found in table:`)
      notFound()
    }
    console.debug(`Found component ${uid} in full table data`)
  } else {
    // if generating at request time (or in development), fetch component directly
    try {
      if (!componentsTable.mappings) {
        throw new Error(
          `No mappings found for ${componentsTable.name} table - cannot reference UID field to fetch record`
        )
      }
      const recordId = await getRecordIdByField(
        componentsTable.tableId,
        componentsTable.mappings.componentUID,
        uid
      )
      if (!recordId) {
        throw new Error(`Failed to fetch record ID for component ${uid}`)
      }
      console.debug(`Fetched record ID ${recordId} for component ${uid}`)
      component = await db.get(componentsTable, recordId)
      if (!component) {
        throw new Error(
          `Failed to fetch component ${uid} with record ID ${recordId}`
        )
      }
      console.debug(
        `Fetched component ${component.componentUID} from Airtable:`
      )
      console.debug(component)
      if (component.componentUID !== uid) {
        throw new Error(
          `Fetched wrong record: ${component.componentUID} != ${uid}`
        )
      }
    } catch (error) {
      console.error(`Error fetching component ${uid}:`, error)
      notFound()
    }
  }

  // type guard to ensure component is defined
  if (!component) {
    console.error(`No component found for UID: ${uid}`)
    notFound()
  }

  // fetch project data
  // TODO: write util to safely get stuff from Airtable (as for component above)
  if (component.project && component.project.length > 0 && component.project[0]) {
    project = await db.get(projectsTable, component.project[0])
    console.debug(project)
  }

  // type guard to ensure project is defined
  if (!project) {
    console.error(`No related project found for component with UID: ${uid}`)
    notFound()
  }

  return (
    // TODO: move Suspense/spinner up to root layout level?
    <Suspense fallback={<LoadingSpinner />}>
      {/* TODO: get this <head> hoisting so as to set page title in browser */}
      <Head>
        <title>{`Passport for component ${uid}`}</title>
      </Head>
      <div className="flex items-centre justify-between">
        <h2>{component.componentName}</h2>
        <p>#{component.number}</p>
      </div>
      <div className="p-2">
        <div className="flex items-center justify-between mb-4">
          <Link href={`/project/${kebabCase(project.projectName)}`} className="flex items-center space-x-1">
            <MoveLeft />
            <p>
              {project.projectName}
            </p>
          </Link>
          {/* TODO: make status a nice button w/ colours according to the miro */}
          <p>
            {component.status}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr]">
          {/* Block name / ID / Image card */}
          <Card>
            <CardHeader>
              <CardTitle></CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="my-2 w-32 h-40 bg-gray-100 border rounded flex items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  <Image src="/building-block.png" width={64} height={64} alt="Block image" />
                </span>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4">
            {/* Info */}
            <div>
              <h2 className="font-semibold">Info</h2>
              <Separator className="my-2" />
            </div>

            <div>
              <h2 className="font-semibold">Materials</h2>
              <Separator className="my-2" />
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between">
                  <span>OSB</span>
                  <span>producer</span>
                  <span>CO₂</span>
                </div>
                <div className="flex justify-between">
                  <span>Insulation</span>
                  <span>producer</span>
                  <span>CO₂</span>
                </div>
              </div>
            </div>

            {/* Design */}
            <div>
              <h2 className="font-semibold">Design</h2>
              <Separator className="my-2" />
              {/* Content goes here */}
            </div>
          </section>

          {/* History / Timeline */}
          <section className="space-y-4">
            <h2 className="font-semibold">History</h2>
            <Separator />
            {/* Simple vertical timeline */}
            <div className="space-y-4">
              {/* Single event */}
              <div>
                <p className="text-sm font-medium">1 Jan 2025</p>
                <p>Event</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium">12 Dec 2024</p>
                <p>Event</p>
                <p className="text-sm text-muted-foreground">
                  Description written as a little paragraph
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium">2 Dec 2024</p>
                <p>Event</p>
                <p className="text-sm text-muted-foreground">
                  Description written as a little paragraph
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col space-y-2">
            <Button variant="default">Action</Button>
          </div>
        </div>
      </div>
    </Suspense>
  )
}
