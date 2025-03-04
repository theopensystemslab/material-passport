import { isNotNil, round  } from 'es-toolkit'
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
// import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import {
  getRecordByField,
  getRecordById,
  scanTable
} from '@/helpers/airtable'
import { getUniquePartFromUid } from '@/helpers/data'
import {
  type Component,
  type OrderBase,
  OrderBaseTable,
  Project,
  componentsTable,
  projectsTable
} from '@/lib/schema'
import windowBlueprint from 'public/window-xl4.svg'

const MAX_DECIMAL_PLACE_PRECISION = 1

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

  let component
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    // if generating at build time, use cached scan of components table
    const components = (await getCachedTable(componentsTable)) as Component[]
    component = components.find((component) => component.componentUID === uid)
    if (!component) {
      console.warn(`No component with UID ${uid} found in table:`)
      notFound()
    }
    console.debug(`Found component ${uid} in full table data`)
  } else {
    // if generating at request time (or in development), fetch component directly
    try {
      component = await getRecordByField(
        componentsTable,
        componentsTable.mappings?.componentUid,
        uid,
        { shouldThrow: true },
      ) as Component
      if (component.componentUid !== uid) {
        throw new Error(`Fetched wrong record: ${component.componentUid} != ${uid}`)
      }
    } catch (error) {
      console.error(`Error fetching component ${uid}:`, error)
      notFound()
    }
  }

  // TODO: also get projects & blocks from cached scans if at build (again, to avoid throttling)
  // fetch data for project of which this component is a member
  let project
  if (component.project?.[0]) {
    project = await getRecordById(projectsTable, component.project[0]) as Project
  }
  
  // if component is from a library, it likely has an image associated, so we also grab the order
  let order
  if (isNotNil(component.librarySource)) {
    console.log('LIBRARY BLOCK')
    order = await getRecordById(OrderBaseTable, component.orderBase[0]) as OrderBase
  }

  console.log('component', component)
  console.log('project', project)
  console.log('order', order)

  return (
    // TODO: move Suspense/spinner up to root layout level?
    // https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
    <Suspense fallback={<LoadingSpinner />}>
      {/* TODO: get this <head> hoisting so as to set page title in browser and/or pull out as custom component */}
      <Head>
        <title>{`Passport for component ${uid}`}</title>
      </Head>
      {project && (
        <Button variant="ghost" size="sm" asChild className="p-0 justify-start text-sm lg:text-md">
          <Link href={`/project/${kebabCase(project.projectName)}`}>
            <MoveLeft /> {project.projectName}
          </Link>
        </Button>
      )}
      <div className="flex flex-col space-y-2">
        <h2>{component.componentName}</h2>
        <div className="flex justify-between">
          <p>#{getUniquePartFromUid(component.componentUid)}</p>
          {/* FIXME: get badge colour assignment working */}
          <Badge className={kebabCase(component.status)}>{component.status}</Badge>
        </div>
      </div>

      {/* TODO: find a more suitable placeholder (currently using WINDOW-XL4 skylark block) */}
      <Card className="relative w-full h-64 lg:h-96">
        <Image
          className="object-contain object-center rounded-md p-2"
          src={order ? order.mainImage[0] : windowBlueprint}
          alt={order ?
            `Orthogonal diagram of ${component.componentName} block` :
            'Placeholder - orthogonal diagram of WINDOW-XL4 block'
          }
          // images are svg so no need to optimise (alternatively we could set dangerouslyAllowSVG in next config)
          unoptimized 
          fill
        />
      </Card>

      {/* SAVE POINT - IGNORE EVERYTHING ABOVE THIS LINE */}

      {/* we use the powerful `asChild` flag (from shadcn/Radix) to enforce semantic html */}
      {/* https://www.radix-ui.com/primitives/docs/guides/composition */}
      {/* TODO: decide which accordions should be expanded by default on page load */}
      <Accordion type="multiple" defaultValue={['info']}>
        <AccordionItem asChild value="info">
          <section>
            <AccordionTrigger>
              <h3>Info</h3>
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableBody>
                  {/* TODO: we don't bother with a header row (data is self-explanatory) - check if this is bad a11y? */}
                  {/* TODO: whittle this section down with a map */}
                  {isNotNil(component.librarySource) && <TableRow>
                    <TableCell className="font-medium">Block library</TableCell>
                    <TableCell className="text-right">{component.librarySource}</TableCell>
                  </TableRow>}
                  <TableRow>
                    <TableCell className="font-medium">Manufacturer</TableCell>
                    <TableCell className="text-right">{component.manufacturer}</TableCell>
                  </TableRow>
                  {isNotNil(component.totalMass) && <TableRow>
                    <TableCell className="font-medium">Mass <small>(kg)</small></TableCell>
                    <TableCell className="text-right">{round(component.totalMass, MAX_DECIMAL_PLACE_PRECISION)}</TableCell>
                  </TableRow>}
                  {isNotNil(component.totalGwp) && <TableRow>
                    {/* TODO: do we need to give time horizon for this GWP measurement, e.g. `GWP-20` */}
                    <TableCell className="font-medium">GWP</TableCell>
                    <TableCell className="text-right">{round(component.totalGwp, MAX_DECIMAL_PLACE_PRECISION)}</TableCell>
                  </TableRow>}
                  {isNotNil(component.totalDistanceTravelled) && <TableRow>
                    <TableCell className="font-medium">Distance travelled <small>(kg)</small></TableCell>
                    <TableCell className="text-right">{round(component.totalDistanceTravelled, MAX_DECIMAL_PLACE_PRECISION)}</TableCell>
                  </TableRow>}
                  {isNotNil(component.totalDistanceTravelled) && <TableRow>
                    <TableCell className="font-medium">Transport emissions <small>(kgCO<sub>2</sub>e)</small></TableCell>
                    <TableCell className="text-right">{round(component.totalDistanceTravelled, MAX_DECIMAL_PLACE_PRECISION)}</TableCell>
                  </TableRow>}
                </TableBody>
              </Table>

            </AccordionContent>
          </section>
        </AccordionItem>
        <AccordionItem asChild value="materials">
          <section>
            <AccordionTrigger>
              <h3>Materials</h3>
            </AccordionTrigger>
            <AccordionContent>
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
            </AccordionContent>
          </section>
        </AccordionItem>
        <AccordionItem asChild value="design">
          <section>
            <AccordionTrigger>
              <h3>Design</h3>
            </AccordionTrigger>
            <AccordionContent>
              ???
            </AccordionContent>
          </section>
        </AccordionItem>
        <AccordionItem asChild value="history">
          <section>
            <AccordionTrigger>
              <h3>History</h3>
            </AccordionTrigger>
            <AccordionContent>
              <div>
                <p className="text-sm font-medium">1 Jan 2025</p>
                <p>Event</p>
              </div>
              <div>
                <p className="text-sm font-medium">12 Dec 2024</p>
                <p>Event</p>
                <p className="text-sm text-muted-foreground">
                  Description written as a little paragraph
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">2 Dec 2024</p>
                <p>Event</p>
                <p className="text-sm text-muted-foreground">
                  Description written as a little paragraph
                </p>
              </div>
            </AccordionContent>
          </section>
        </AccordionItem>
      </Accordion>

      {/* TODO: make this button do something! (via server action) */}
      {/* https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations */}
      <div className="flex flex-col space-y-2">
        <Button variant="default">Action</Button>
      </div>
    </Suspense>
  )
}
