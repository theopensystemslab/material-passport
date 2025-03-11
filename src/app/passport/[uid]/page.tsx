import {
  isNotNil,
  lowerCase,
  round
} from 'es-toolkit'
import { kebabCase } from 'es-toolkit/string'
import { Image as ImageIcon, MoveLeft  } from 'lucide-react'
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
import {
  getCachedScan,
  getRecordByField,
  getRecordById,
} from '@/helpers/airtable'
import { ComponentStatus } from '@/lib/definitions'
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
  [ComponentStatus.DesignInProgress]: [ComponentStatus.ReadyForProduction],
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
const getComponentsCache = getCachedScan<Component>(componentsTable, 'components', 180)
const getProjectsCache = getCachedScan<Project>(projectsTable, 'projects', 900)
const getOrdersCache = getCachedScan<OrderBase>(orderBaseTable, 'orders', 900)
const getMaterialsCache = getCachedScan<Material>(materialsTable, 'materials', 900)

// this runs once, at build time, to prepare static pages for every component
export async function generateStaticParams(): Promise<{ uid: string }[]> {
  // kick off table scans for purpose of caching, to be accessed during page builds
  const getComponentsPromise = getComponentsCache()
  getProjectsCache()
  getOrdersCache()
  getMaterialsCache()
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
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    // if generating at build time, use cached scan of components table
    const components = await getComponentsCache()
    component = components.find((component) => component.componentUid === uid)
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
  const componentStatus = getComponentStatusEnum(component.status)

  // TODO: also get project, order & materials from cached scans if at build (or generally, since we revalidate these less often?)
  // fetch data for project of which this component is a member
  let project
  if (component.project?.[0]) {
    project = await getRecordById(projectsTable, component.project[0]) as Project
  }
  
  // fetch order from which this component was mandated
  let order
  if (component.project?.[0]) {
    order = await getRecordById(orderBaseTable, component.orderBase[0]) as OrderBase
  }

  interface Materials {
    timber?: Material,
    insulation?: Material,
    fixings?: Material,
  }

  // fetch various materials used in this component
  const materials: Materials = {}
  if (isNotNil(component.materialsTimber?.[0])) {
    materials.timber = await getRecordById(materialsTable, component.materialsTimber[0])
  }
  if (isNotNil(component.materialsInsulation?.[0])) {
    materials.insulation = await getRecordById(materialsTable, component.materialsInsulation[0])
  }
  if (isNotNil(component.materialsFixings?.[0])) {
    materials.fixings = await getRecordById(materialsTable, component.materialsFixings[0])
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
