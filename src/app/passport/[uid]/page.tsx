import { isNotNil, round } from 'es-toolkit'
import { kebabCase } from 'es-toolkit/string'
import {
  Check,
  Image as ImageIcon,
  MoveLeft,
} from 'lucide-react'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { type JSX, Suspense } from 'react'

import { StatusTransitionButtons } from '@/app/passport/[uid]/StatusTransitionButtons'
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
  getFieldNameMemoized,
  getRecordByField,
  getRecordFromScan,
  getRecordsByField,
  getRecordsFromScan,
} from '@/lib/airtable'
import { ComponentStatus } from '@/lib/definitions'
import {
  type AllBlock,
  type Component,
  type History,
  type Material,
  type OrderBase,
  type Project,
  type Supplier,
  allBlocksTable,
  componentsTable,
  historyTable,
  materialsTable,
  orderBaseTable,
  projectsTable,
  suppliersTable,
} from '@/lib/schema'
import { getComponentStatusEnum, truncate } from '@/lib/utils'

const MAX_DECIMAL_PLACE_PRECISION: number = 1
const SHORT_CACHE_TIME_SECONDS = 180

// we use ISR to generate static passports at build and fetch fresh data at request time as needed
export const revalidate = 180

// we give each scan a separate tag to enable us to clear cache on demand (using revalidatePath)
const getComponents = getCachedScan<Component>(componentsTable, SHORT_CACHE_TIME_SECONDS)
const getHistory = getCachedScan<History>(historyTable, SHORT_CACHE_TIME_SECONDS)
const getProjects = getCachedScan<Project>(projectsTable)
const getOrders = getCachedScan<OrderBase>(orderBaseTable)
const getMaterials = getCachedScan<Material>(materialsTable)
const getSuppliers = getCachedScan<Supplier>(suppliersTable)
const getBlocks = getCachedScan<AllBlock>(allBlocksTable)

// we also get any memoized field name lookups we might need
const getComponentFieldName = getFieldNameMemoized(componentsTable)
const getHistoryFieldName = getFieldNameMemoized(historyTable)

// this runs once, at build time, to prepare static pages for every component
export async function generateStaticParams(): Promise<{ uid: string }[]> {
  // kick off table scans for purpose of caching, to be accessed during page builds
  const getComponentsPromise = getComponents()
  getHistory()
  getProjects()
  getOrders()
  getMaterials()
  getSuppliers()
  getBlocks()
  // wait for component scan to complete
  const components = await getComponentsPromise
  // ignore any records without UID (none should exist anyway)
  return components
    .filter((component) => isNotNil(component.componentUid))
    .map((component) => ({ uid: component.componentUid as string }))
}

export default async function Page({params}: {
  params: Promise<{
    uid: string;
  }>;
}): Promise<JSX.Element> {
  const { uid } = await params

  let component: Component | null = null
  const history: History[] = []
  try {
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      // if generating at build time, use cached scan of component and history tables
      const componentUidFieldName = getComponentFieldName(componentsTable.mappings?.componentUid)
      component = await getRecordFromScan<Component>(
        getComponents,
        uid,
        componentUidFieldName,
        { shouldThrow: true },
      )
      const historyUidFieldName = getHistoryFieldName(historyTable.mappings?.historyUid)
      if (component?.history?.[0]) {
        history.push(...await getRecordsFromScan<History>(
          getHistory,
          component.history,
          historyUidFieldName,
        ))
      }
    } else {
      // if generating at request time (or in development), fetch component and history directly
      component = await getRecordByField<Component>(
        componentsTable,
        componentsTable.mappings?.componentUid,
        uid,
        { shouldThrow: true },
      )
      if (component?.history?.[0]) {
        history.push(...await getRecordsByField<History>(
          historyTable,
          historyTable.mappings?.historyUid,
          component.history,
        ))
      }
    }
    // finally run a type check and validate that we have the correct record
    if (!component) {
      throw new Error(`Failed to fetch component with UID ${uid}`)
    }
    if (component && component.componentUid !== uid) {
      throw new Error(`Fetched wrong record: ${component.componentUid} != ${uid}`)
    }
    if (history.length === 0) {
      console.warn(`Component ${uid} has no entries in its history`)
    }
  } catch (e) {
    console.error(e)
    notFound()
  }
  const componentStatus = getComponentStatusEnum(component.status)

  // we also fetch related project, order, suppliers, library source and material records (but if any fail, we still render)
  // we always use cached scans here (regardless of env), since these tables change less frequently
  let project: Project | null = null
  if (component.project?.[0]) {
    project = await getRecordFromScan<Project>(
      getProjects,
      component.project[0],
    )
  } else {
    console.warn(`Component ${uid} has no associated project`)
  }
  
  let order: OrderBase | null = null
  if (component.orderBase?.[0]) {
    order = await getRecordFromScan<OrderBase>(getOrders, component.orderBase[0])
  } else {
    console.warn(`Component ${uid} has no associated order`)
  }

  // some components may be manufactured by multiple agents (e.g. fabricated by one shop, assembled elsewhere)
  const suppliers: Supplier[] = []
  if (component.manufacturer?.[0]) {
    for (const supplierId of component.manufacturer) {
      const supplier = await getRecordFromScan<Supplier>(getSuppliers, supplierId)
      if (supplier) {
        suppliers.push(supplier)
      }
    }
  } else {
    console.warn(`Component ${uid} has no associated manufacturer(s)`)
  }
  
  let block: AllBlock | null = null
  if (component.librarySource?.[0]) {
    block = await getRecordFromScan<AllBlock>(getBlocks, component.librarySource[0])
  } else {
    console.warn(`Component ${uid} has no associated block library source`)
  }

  interface Materials {
    timber?: Material | null,
    insulation?: Material | null,
    fixings?: Material | null,
  }

  // fetch various materials used in this component
  const materials: Materials = {}
  if (component.materialsTimber?.[0]) {
    materials.timber = await getRecordFromScan<Material>(
      getMaterials, component.materialsTimber[0])
  } else {
    console.warn(`Component ${uid} has no associated timber material`)
  }
  if (component.materialsInsulation?.[0]) {
    materials.insulation = await getRecordFromScan<Material>(
      getMaterials, component.materialsInsulation[0])
  } else {
    console.warn(`Component ${uid} has no associated insulation material`)
  }
  if (component.materialsFixings?.[0]) {
    materials.fixings = await getRecordFromScan<Material>(
      getMaterials, component.materialsFixings[0])
  } else {
    console.warn(`Component ${uid} has no associated fixings material`)
  }

  // FIXME: remove these logs - just for dev purposes
  console.log('component', component)
  console.log('history', history)
  console.log('project', project)
  console.log('order', order)
  console.log('block', block)
  for (const supplier of suppliers) {
    console.log(`supplier ${supplier.supplierName}`, supplier)
  }

  // fix some variables here for expediency
  const mainImage = order?.mainImageCustom?.[0] || order?.mainImageFromLibrarySource?.[0]
  // custom assembly manual is an attachment, the rest are URLs
  const modelFile = order?._3dmodelcustom || order?.githubModelDetailedFromLibrarySource
  const assemblyFile = order?.assemblyManualCustom?.[0] || order?.githubAssemblyGuideFromLibrarySource
  const cuttingFile = order?.cuttingFilesCustom || order?.githubCuttingFileFromLibrarySource

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
        <h1>{component.componentName}</h1>
        <div className="flex justify-between">
          <small>#{component.componentUid}</small>
          <Badge className={kebabCase(component.status)}>{component.status}</Badge>
        </div>
      </div>
      <Card className="relative w-full h-64 lg:h-96 flex justify-center items-center">
        {mainImage ? <Image
          className="object-contain object-center rounded-md p-2"
          src={mainImage}
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
                  {isNotNil(block?.name) && <TableRow>
                    <TableCell className="font-medium">Block library</TableCell>
                    <TableCell className="text-right text-nowrap">{block.name}</TableCell>
                  </TableRow>}
                  {isNotNil(suppliers?.[0]) && <TableRow>
                    <TableCell className="font-medium">Manufacturer(s)</TableCell>
                    <TableCell className="text-right whitespace-pre">
                      {suppliers.map(supplier => supplier.supplierName).join('\n')}
                    </TableCell>
                  </TableRow>}
                  {isNotNil(component.totalMass) && <TableRow>
                    <TableCell className="font-medium">Mass</TableCell>
                    <TableCell className="text-right">{round(component.totalMass, MAX_DECIMAL_PLACE_PRECISION)} <small>kg</small></TableCell>
                  </TableRow>}
                  {/* TODO: add a link / tooltip to explain GWP? (e.g. https://en.wikipedia.org/wiki/Global_warming_potential) */}
                  {isNotNil(component.totalGwp) && <TableRow>
                    <TableCell className="font-medium">
                      Global warming potential <small>
                        <a href="https://en.wikipedia.org/wiki/Global_warming_potential" target="_blank">(GWP)</a>
                      </small>
                    </TableCell>
                    <TableCell className="text-right">{round(component.totalGwp, MAX_DECIMAL_PLACE_PRECISION)}</TableCell>
                  </TableRow>}
                  {isNotNil(order?.gwpFossil) && <TableRow>
                    <TableCell className="font-medium">GWP <small>(fossil)</small></TableCell>
                    <TableCell className="text-right">
                      {round(order.gwpFossil, MAX_DECIMAL_PLACE_PRECISION)}
                    </TableCell>
                  </TableRow>}
                  {isNotNil(order?.gwpBiogenic) && <TableRow>
                    <TableCell className="font-medium">GWP <small>(biogenic)</small></TableCell>
                    <TableCell className="text-right">
                      {round(order.gwpBiogenic, MAX_DECIMAL_PLACE_PRECISION)}
                    </TableCell>
                  </TableRow>}
                  {isNotNil(component.totalDistanceTravelled) && <TableRow>
                    <TableCell className="font-medium">Distance travelled</TableCell>
                    <TableCell className="text-right">
                      {round(component.totalDistanceTravelled, MAX_DECIMAL_PLACE_PRECISION)} <small>km</small>
                    </TableCell>
                  </TableRow>}
                  {isNotNil(component.totalDistanceTravelled) && <TableRow>
                    <TableCell className="font-medium">Transport emissions</TableCell>
                    <TableCell className="text-right">{round(component.totalDistanceTravelled, MAX_DECIMAL_PLACE_PRECISION)}  <small>kgCO<sub>2</sub>e</small></TableCell>
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
                {/* TODO: make the below thumbnail images expandable for inspection, and extract row as separate component */}
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
                    <TableCell>{materials.timber.producer || '-'}</TableCell>
                    <TableCell className="text-right">{materials.timber.gwpTotal || '-'}</TableCell>
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
                    <TableCell>{materials.insulation.producer || '-'}</TableCell>
                    <TableCell className="text-right">{materials.insulation.gwpTotal || '-'}</TableCell>
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
                    <TableCell>{materials.fixings.producer || '-'}</TableCell>
                    <TableCell className="text-right">{materials.fixings.gwpTotal || '-'}</TableCell>
                  </TableRow>}
                </TableBody>
              </Table>
            </AccordionContent>
          </section>
        </AccordionItem>
        {<AccordionItem asChild value="design">
          <section>
            <AccordionTrigger>
              <h3>Design</h3>
            </AccordionTrigger>
            <AccordionContent>
              {order && (modelFile || assemblyFile || cuttingFile) ? <Table>
                <TableBody>
                  {modelFile && <TableRow>
                    <TableCell className="font-medium">3D model</TableCell>
                    <TableCell className="text-right">
                      <a href={modelFile} target="_blank">
                        {truncate(modelFile.split('/').pop()) ||
                          (order._3dmodelcustom ? 'Custom' : 'Github')}
                      </a>
                    </TableCell>
                  </TableRow>}
                  {assemblyFile &&
                  <TableRow>
                    <TableCell className="font-medium">Assembly manual</TableCell>
                    <TableCell className="text-right">
                      <a href={assemblyFile} target="_blank">
                        {/* custom assembly manuals are airtable attachment, so url is nonsense */}
                        {order.assemblyManualCustom ? 'Custom' :
                          (truncate(assemblyFile.split('/').pop()) || 'Github')}
                      </a>
                    </TableCell>
                  </TableRow>}
                  {cuttingFile && <TableRow>
                    <TableCell className="font-medium">Production file</TableCell>
                    <TableCell className="text-right">
                      <a href={cuttingFile} target="_blank">
                        {truncate(cuttingFile.split('/').pop()) ||
                          (order.cuttingFilesCustom ? 'Custom' : 'Github')}
                      </a>
                    </TableCell>
                  </TableRow>}
                </TableBody>
              </Table> : <p className="text-center">No design files available</p>}
            </AccordionContent>
          </section>
        </AccordionItem>}

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
      
      <div className="flex flex-col space-y-2">
        {componentStatus === ComponentStatus.ReadyForProduction &&
        component.label?.[0] && <Button variant="default" asChild>
          {/* we can't have the pdf download directly on click since that is only permitted for same site origin */}
          <a href={component.label[0]} target="_blank">
            Download label
          </a>
        </Button>}
        <StatusTransitionButtons
          componentUid={uid}
          componentRecordId={component.id}
          currentComponentStatus={componentStatus}
        />
      </div>

    </Suspense>
  )
}
