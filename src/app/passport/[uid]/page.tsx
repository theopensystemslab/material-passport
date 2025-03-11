import {
  isNotNil,
  lowerCase,
  round
} from 'es-toolkit'
import { kebabCase } from 'es-toolkit/string'
import {
  Check,
  Image as ImageIcon,
  MoveLeft
} from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Timeline, TimelineItem } from '@/components/ui/timeline'
import {
  getCachedScan,
  getFieldNameByFieldId,
  getRecordByField,
  getRecordFromScan,
} from '@/helpers/airtable'
import { ComponentStatus, type Nil } from '@/lib/definitions'
import {
  type Component,
  type Material,
  type OrderBase,
  type Project,
  componentsTable,
  materialsTable,
  orderBaseTable,
  projectsTable
} from '@/lib/schema'
import { getComponentStatusEnum } from '@/lib/utils'

const MAX_DECIMAL_PLACE_PRECISION: number = 1
const STATUS_TRANSITIONS: Record<ComponentStatus, ComponentStatus[]> = {
  [ComponentStatus.DesignInProgress]: [],
  [ComponentStatus.ReadyForProduction]: [ComponentStatus.Manufactured],
  [ComponentStatus.Manufactured]: [ComponentStatus.InTransit, ComponentStatus.ReceivedOnSite],
  [ComponentStatus.InTransit]: [ComponentStatus.ReceivedOnSite],
  [ComponentStatus.ReceivedOnSite]: [ComponentStatus.Installed],
  [ComponentStatus.Installed]: [ComponentStatus.InUse],
  [ComponentStatus.InUse]: [],
}

// we use ISR to generate static passports at build and fetch fresh data at request time as needed
export const revalidate = 180

// we give each scan a separate tag to enable us to clear cache on demand (using revalidatePath)
const componentsCache = getCachedScan<Component>(componentsTable, 180)
const projectsCache = getCachedScan<Project>(projectsTable)
const ordersCache = getCachedScan<OrderBase>(orderBaseTable)
const materialsCache = getCachedScan<Material>(materialsTable)

// this runs once, at build time, to prepare static pages for every component
export async function generateStaticParams(): Promise<{ uid: string }[]> {
  // kick off table scans for purpose of caching, to be accessed during page builds
  // TODO: demonstrate to my satisfaction that the cache is actually being hit on repeated table scans
  const getComponentsPromise = componentsCache()
  projectsCache()
  ordersCache()
  materialsCache()
  // wait for component scan to complete
  const components = await getComponentsPromise
  // ignore any records without UID (none should exist anyway)
  return components
    .filter((component) => isNotNil(component.componentUid))
    .map((component) => ({ uid: component.componentUid as string }))
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
  try {
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      // if generating at build time, use cached scan of components table
      const componentUidFieldName = getFieldNameByFieldId(componentsTable, componentsTable.mappings?.componentUid)
      component = await getRecordFromScan<Component>(
        componentsCache,
        uid,
        componentUidFieldName,
        { shouldThrow: true },
      )
    } else {
      // if generating at request time (or in development), fetch component directly
      component = await getRecordByField<Component>(
        componentsTable,
        componentsTable.mappings?.componentUid,
        uid,
        { shouldThrow: true },
      )
    }
    // finally run a type check and validate that we have the correct record
    if (!component) {
      throw new Error(`Failed to fetch component with UID ${uid}`)
    }
    if (component && component.componentUid !== uid) {
      throw new Error(`Fetched wrong record: ${component.componentUid} != ${uid}`)
    }
  } catch (e) {
    console.error(e)
    notFound()
  }

  const componentStatus = getComponentStatusEnum(component.status)

  // we also fetch related project, order and material records (but unlike for the component, if any fail, we don't error out)
  // we always use cached scans here (regardless of env), since these tables change less frequently
  let project
  if (component.project?.[0]) {
    project = await getRecordFromScan<Project>(
      projectsCache,
      component.project[0],
    )
  } else {
    console.warn(`Component ${uid} has no associated project`)
  }
  
  let order
  if (component.orderBase?.[0]) {
    order = await getRecordFromScan<OrderBase>(ordersCache, component.orderBase[0])
  } else {
    console.warn(`Component ${uid} has no associated order`)
  }

  interface Materials {
    timber?: Material | Nil,
    insulation?: Material | Nil,
    fixings?: Material | Nil,
  }

  // fetch various materials used in this component
  const materials: Materials = {}
  if (component.materialsTimber?.[0]) {
    materials.timber = await getRecordFromScan<Material>(
      materialsCache, component.materialsTimber[0])
  } else {
    console.warn(`Component ${uid} has no associated timber material`)
  }
  if (component.materialsInsulation?.[0]) {
    materials.insulation = await getRecordFromScan<Material>(
      materialsCache, component.materialsInsulation[0])
  } else {
    console.warn(`Component ${uid} has no associated insulation material`)
  }
  if (component.materialsFixings?.[0]) {
    materials.fixings = await getRecordFromScan<Material>(
      materialsCache, component.materialsFixings[0])
  } else {
    console.warn(`Component ${uid} has no associated fixings material`)
  }

  // FIXME: remove these logs - just for dev purposes
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
          <p>#{component.componentUid}</p>
          {/* FIXME: get badge colour assignment working */}
          <Badge className={kebabCase(component.status)}>{component.status}</Badge>
        </div>
      </div>

      <Card className="relative w-full h-64 lg:h-96 flex justify-center items-center">
        {order?.mainImage?.[0] ?
          <Image
            className="object-contain object-center rounded-md p-2"
            src={order.mainImage[0]}
            alt={`Orthogonal diagram of ${component.componentName}`}
            // images are svg so no need to optimise (alternatively we could set dangerouslyAllowSVG in next config)
            unoptimized
            priority
            fill
          /> : <ImageIcon className="w-full h-16 lg:h-24 opacity-70" />
        }
      </Card>
      {/* we use the powerful `asChild` flag (from shadcn/Radix) to enforce semantic html */}
      {/* https://www.radix-ui.com/primitives/docs/guides/composition */}
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
                    <TableCell className="font-medium">Global warming potential</TableCell>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Producer</TableHead>
                    <TableHead className="text-right">CO<sub>2</sub></TableHead>
                  </TableRow>
                </TableHeader>
                {/* TODO: make the below thumbnail images expandable for inspection, and extract as separate component */}
                <TableBody>
                  {isNotNil(materials.timber) && <TableRow>
                    <TableCell>
                      <div className="relative w-6 h-6 lg:w-10 lg:h-10 flex justify-center items-center">
                        {materials.timber.thumbnail?.[0] ?
                          <Image
                            className="object-cover object-center rounded-full"
                            src={materials.timber.thumbnail[0]}
                            alt="Thumbnail of material used for timber"
                            sizes="(min-width: 1024px) 40px, 24px"
                            fill
                          /> : <ImageIcon className="opacity-70" />
                        }
                      </div>
                    </TableCell>
                    <TableCell>{materials.timber.materialName}</TableCell>
                    <TableCell>{materials.timber.producer}</TableCell>
                    <TableCell className="text-right">{materials.timber.gwp}</TableCell>
                  </TableRow>}
                  {isNotNil(materials.insulation) && <TableRow>
                    <TableCell>
                      <div className="relative w-6 h-6 lg:w-10 lg:h-10 flex justify-center items-center">
                        {materials.insulation.thumbnail?.[0] ?
                          <Image
                            className="object-cover object-center rounded-full"
                            src={materials.insulation.thumbnail[0]}
                            alt="Thumbnail of material used for insulation"
                            sizes="(min-width: 1024px) 40px, 24px"
                            fill
                          /> : <ImageIcon className="opacity-70" />
                        }
                      </div>
                    </TableCell>
                    <TableCell>{materials.insulation.materialName}</TableCell>
                    <TableCell>{materials.insulation.producer}</TableCell>
                    <TableCell className="text-right">{materials.insulation.gwp}</TableCell>
                  </TableRow>}
                  {isNotNil(materials.fixings) && <TableRow>
                    <TableCell>
                      <div className="relative w-6 h-6 lg:w-10 lg:h-10 flex justify-center items-center">
                        {materials.fixings.thumbnail?.[0] ?
                          <Image
                            className="object-cover object-center rounded-full"
                            src={materials.fixings.thumbnail[0]}
                            alt="Thumbnail of material used for fixings"
                            sizes="(min-width: 1024px) 40px, 24px"
                            fill
                          /> : <ImageIcon className="opacity-70" />
                        }
                      </div>
                    </TableCell>
                    <TableCell>{materials.fixings.materialName}</TableCell>
                    <TableCell>{materials.fixings.producer}</TableCell>
                    <TableCell className="text-right">{materials.fixings.gwp}</TableCell>
                  </TableRow>}
                </TableBody>
              </Table>
            </AccordionContent>
          </section>
        </AccordionItem>
        <AccordionItem asChild value="design">
          <section>
            <AccordionTrigger>
              <h3>Design</h3>
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                {/* TODO: add switch logic to provide custom versions in case they exist (prefer custom over github!) */}
                <TableBody>
                  {order?.githubModelDetailedFromLibrarySource && <TableRow>
                    <TableCell className="font-medium">3D model</TableCell>
                    <TableCell className="text-right">
                      <a href={order?.githubModelDetailedFromLibrarySource}>
                        {order?.githubModelDetailedFromLibrarySource.split('/').pop()}
                      </a>
                    </TableCell>
                  </TableRow>}
                  {order?.githubCuttingFileFromLibrarySource &&
                  <TableRow>
                    <TableCell className="font-medium">Production files</TableCell>
                    <TableCell className="text-right">
                      <a href={order?.githubCuttingFileFromLibrarySource}>
                        {order?.githubCuttingFileFromLibrarySource.split('/').pop()}
                      </a>
                    </TableCell>
                  </TableRow>}
                  {order?.githubAssemblyGuideFromLibrarySource && <TableRow>
                    <TableCell className="font-medium">Assembly manual</TableCell>
                    <TableCell className="text-right">
                      <a href={order?.githubAssemblyGuideFromLibrarySource}>
                        {order?.githubAssemblyGuideFromLibrarySource.split('/').pop()}
                      </a>
                    </TableCell>
                  </TableRow>}
                </TableBody>
              </Table>
            </AccordionContent>
          </section>
        </AccordionItem>

        {/* SAVE POINT - IGNORE EVERYTHING ABOVE THIS LINE */}

        <AccordionItem asChild value="history">
          <section>
            <AccordionTrigger>
              <h3>History</h3>
            </AccordionTrigger>
            <AccordionContent>
              <Timeline>
                <TimelineItem
                  date="2024-01-01"
                  title="Feature Released"
                  description="New timeline component is now available"
                  icon={<Check />}
                  status="completed"
                />
                <TimelineItem
                  date="2024-01-01"
                  title="In Progress"
                  description="Working on documentation"
                  status="in-progress"
                />
                <TimelineItem
                  date="2024-01-01"
                  title="Upcoming"
                  description="Planning future updates"
                  status="pending"
                />
              </Timeline>
            </AccordionContent>
          </section>
        </AccordionItem>
      </Accordion>

      {/* TODO: make available actions dependent on profile type (e.g. manufacturer, installer, owner etc.) */}
      {/* TODO: make this button do something! (via server action) */}
      {/* 2. make button do appropriate action (not yet including print label) */}
      <div className="flex flex-col space-y-2">
        {componentStatus === ComponentStatus.ReadyForProduction && 
          <Button variant="default">Print label</Button>}
        {STATUS_TRANSITIONS[componentStatus].map((statusTransition, i) => (
          <Button key={i} variant="default">Mark as {lowerCase(statusTransition)}</Button>
        ))}
      </div>
    </Suspense>
  )
}
