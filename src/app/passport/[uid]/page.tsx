import {
  isNotNil,
  lowerCase,
  round
} from 'es-toolkit'
import { kebabCase } from 'es-toolkit/string'
import {
  Blocks,
  CircleSlash2,
  DraftingCompass,
  Factory,
  Image as ImageIcon,
  MoveLeft,
  Pencil,
  SquarePen,
  Truck
} from 'lucide-react'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { type JSX, Suspense } from 'react'

import { AddRecordDialog } from '@/app/passport/[uid]/AddRecordDialog'
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
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineDot,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/ui/timeline'
import {
  getBlocks,
  getComponentFieldName,
  getComponents,
  getHistory,
  getHistoryFieldName,
  getMaterials,
  getOrders,
  getProjects,
  getRecordByField,
  getRecordFromScan,
  getRecordsById,
  getRecordsFromScan,
  getSuppliers,
} from '@/lib/airtable'
import { ComponentStatus, HistoryEvent } from '@/lib/definitions'
import {
  type AllBlock,
  type Component,
  type History,
  type Material,
  type OrderBase,
  type Project,
  type Supplier,
  componentsTable,
  historyTable,
} from '@/lib/schema'
import {
  getComponentStatusEnum,
  getDateReprFromEpoch,
  getHistoryEventEnum,
  getLocationReprFromHistory,
  truncate
} from '@/lib/utils'

const MAX_DECIMAL_PLACE_PRECISION: number = 1
const ICON_BY_HISTORY_EVENT = {
  [HistoryEvent.DesignCompleted]: DraftingCompass,
  [HistoryEvent.Manufactured]: Factory,
  [HistoryEvent.Moved]: Truck,
  [HistoryEvent.Installed]: Blocks,
  [HistoryEvent.Record]: SquarePen,
}

// we use ISR to generate static passports at build and fetch fresh data at request time as needed
export const revalidate = 180


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

// TODO: implement dynamic metadata generation in favour of next/head
// https://nextjs.org/docs/app/building-your-application/optimizing/metadata#dynamic-metadata
// export async function generateMe

export default async function Page({params}: {
  params: Promise<{
    uid: string
  }>
}): Promise<JSX.Element> {
  const { uid } = await params

  let component: Component | null = null
  let componentStatus: ComponentStatus | null = null
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
        history.push(...await getRecordsById<History>(
          historyTable,
          component.history,
        ))
      }
    }
    // run a type check and validate that we have the correct record
    if (!component) {
      throw new Error(`Failed to fetch component with UID ${uid}`)
    }
    if (component && component.componentUid !== uid) {
      throw new Error(`Fetched wrong record: ${component.componentUid} != ${uid}`)
    }
    if (history.length === 0) {
      console.warn(`Component ${uid} has no entries in its history`)
    } else {
      console.debug('Ensuring history is sorted chronogically (i.e. ascending by time of creation)')
      history.sort((a: History, b: History) => a.createdAt - b.createdAt)
    }
    // finally get enum for component status
    componentStatus = getComponentStatusEnum(component.status, { shouldThrow: true })
  } catch (e) {
    console.error(e)
    notFound()
  }

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
  for (const record of history) {
    console.log(`history record ${record.historyUid}:`, record)
  }
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
      {/* TODO: when we have no main image, use latest photo from history, if one exists */}
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
        <AccordionItem asChild value="history">
          <section>
            <AccordionTrigger>
              <h3>History</h3>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col p-2 space-y-4">
                <Timeline>
                  {history?.[0] ? history.map((record, i) => (
                    <TimelineItem key={i}>
                      <TimelineSeparator>
                        <TimelineDot>
                          {record.event && (() => {
                            const Icon = ICON_BY_HISTORY_EVENT[getHistoryEventEnum(record.event) as HistoryEvent]
                            return Icon ? <Icon /> : <></>
                          })()}
                        </TimelineDot>
                        <TimelineConnector />
                      </TimelineSeparator>
                      <TimelineContent>
                        <TimelineTitle className="text-lg lg:text-xl font-semibold">{record.event}</TimelineTitle>
                        <TimelineDescription className="text-md lg:text-lg text-foreground">{record.description}</TimelineDescription>
                        {record.photo?.[0] && <div className="relative w-full h-64 lg:h-96">
                          <Image
                            className="object-contain object-left rounded-sm py-4 max-w-full"
                            src={record.photo[0]}
                            alt={`Photo for history event ${lowerCase(record.event)}`}
                            sizes="(min-width: 1024px) 100vw, 100vw"
                            fill
                          />
                        </div>}
                        <br />
                        <p className="text-muted-foreground">
                          {getLocationReprFromHistory(record)}
                        </p>
                        <p className="text-muted-foreground">
                          {getDateReprFromEpoch(record.createdAt, { pretty: true })}
                        </p>
                      </TimelineContent>
                    </TimelineItem>
                  )) : <TimelineItem>
                    <TimelineSeparator>
                      <TimelineDot>
                        <CircleSlash2 />
                      </TimelineDot>
                      <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                      <TimelineTitle className="text-md lg:text-lg font-semibold">
                        No events recorded
                      </TimelineTitle>
                    </TimelineContent>
                  </TimelineItem>}
                  <TimelineItem>
                    <TimelineSeparator>
                      <TimelineDot>
                        <Pencil/>
                      </TimelineDot>
                      <TimelineConnector />
                    </TimelineSeparator>
                    <AddRecordDialog componentId={component.id} componentUid={uid}/>
                  </TimelineItem>
                </Timeline> 
              </div>
            </AccordionContent>
          </section>
        </AccordionItem>
      </Accordion>
      
      <section>
        <div className="flex flex-col space-y-2 lg:space-y-4">
          {componentStatus === ComponentStatus.ReadyForProduction &&
        // since we can't control button variant dynamically according to media query, we do it manually with similar classes
        component.label?.[0] && <Button variant="default" asChild className="rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg">
            {/* we can't have the pdf download directly on click since that is only permitted for same site origin */}
            <a href={component.label[0]} target="_blank">
              Download label
            </a>
          </Button>}
          <StatusTransitionButtons
            componentUid={uid}
            componentRecordId={component.id}
            // we cast here to avoid tsc error (if it was null getComponentStatusEnum would have thrown and we'd show 404)
            currentComponentStatus={componentStatus as ComponentStatus}
          />
        </div>
      </section>

    </Suspense>
  )
}
