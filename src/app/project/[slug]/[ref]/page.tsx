import { isNotNil, round } from 'es-toolkit'
import { kebabCase } from 'es-toolkit/string'
import { Image as ImageIcon } from 'lucide-react'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { type JSX, Suspense } from 'react'

import { AirtableAttachmentLink } from '@/components/AirtableAttachmentLink'
import { AirtableImage } from '@/components/AirtableImage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ReturnButton } from '@/components/ReturnButton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
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
  getBlocks,
  getComponents,
  getMaterials,
  getOrderFieldName,
  getOrders,
  getProjects,
  getRecordByField,
  getRecordFromScan,
  getRecordsFromScan,
  getSuppliers,
} from '@/lib/airtable'
import { ComponentStatus } from '@/lib/definitions'
import {
  type AllBlock,
  type Component,
  type Material,
  type OrderBase,
  type Project,
  type Supplier,
  materialsTable,
  orderBaseTable,
} from '@/lib/schema'
import {
  dekebab,
  getComponentStatusEnum,
  getTotalGwp,
  truncate,
} from '@/lib/utils'

const MAX_DECIMAL_PLACE_PRECISION: number = 1

export const revalidate = 7200

export async function generateStaticParams(): Promise<{ ref: string }[]> {
  const orders = await getOrders()
  // TODO: filter for production-ready orders
  return orders
    .filter((order) => isNotNil(order.orderRef))
    .map((order) => ({ ref: order.orderRef as string }))
}

export default async function Page({params}: {
  params: Promise<{
    slug: string,
    ref: string
  }>
}): Promise<JSX.Element> {
  const { slug, ref } = await params
  const projectName = dekebab(slug)
  console.debug(`Attempting to build page for order ${ref} of project ${projectName}`)

  let order: OrderBase | null = null
  let orderStatus: ComponentStatus | null = null
  try {
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      const orderRefFieldName = getOrderFieldName(orderBaseTable.mappings?.orderRef)
      order = await getRecordFromScan<OrderBase>(
        getOrders,
        ref,
        orderRefFieldName,
        { shouldThrow: true },
      )} else {
      order = await getRecordByField<OrderBase>(
        orderBaseTable,
        orderBaseTable.mappings?.orderRef,
        ref,
        { shouldThrow: true },
      )}
    if (!order) {
      throw new Error(`Failed to fetch order with ref ${ref}`)
    }
    if (order && order.orderRef !== ref) {
      throw new Error(`Fetched wrong record: ${order.orderRef} != ${ref}`)
    }
    orderStatus = getComponentStatusEnum(order.status, { shouldThrow: true })
    if (!orderStatus) {
      throw new Error(`Order ${ref} has no status`)
    }
  } catch (e) {
    console.error(e)
    notFound()
  }

  // since we expect multiple components in many cases, we use the scan rather than fetching them individually
  const components: Component[] = []
  if (order?.components?.[0]) {
    components.push(...await getRecordsFromScan<Component>(
      getComponents,
      order.components,
    ))
  }
  if (components.length === 0) {
    console.warn(`Order ${ref} has no associated components`)
  }

  let project: Project | null = null
  if (order.project?.[0]) {
    project = await getRecordFromScan<Project>(
      getProjects,
      order.project[0],
    )
    if (order.projectName !== projectName) {
      console.error(`Fetched wrong record: ${order.projectName} != ${projectName}`)
    }
  } else {
    console.warn(`Order ${ref} has no associated project`)
  }
  
  const suppliers: Supplier[] = []
  if (order.supplier?.[0]) {
    for (const supplierId of order.supplier) {
      const supplier = await getRecordFromScan<Supplier>(getSuppliers, supplierId)
      if (supplier) {
        suppliers.push(supplier)
      }
    }
  } else {
    console.warn(`Order ${ref} has no associated manufacturer(s)`)
  }
  
  let block: AllBlock | null = null
  if (order.librarySource?.[0]) {
    block = await getRecordFromScan<AllBlock>(getBlocks, order.librarySource[0])
  } else {
    console.warn(`Order ${ref} has no associated block library source`)
  }

  interface Materials {
    timber?: Material | null,
    insulation?: Material | null,
    fixings?: Material | null,
  }

  const materials: Materials = {}
  if (order.materialsTimber?.[0]) {
    materials.timber = await getRecordFromScan<Material>(
      getMaterials, order.materialsTimber[0])
  } else {
    console.warn(`Order ${ref} has no associated timber material`)
  }
  if (order.materialsInsulation?.[0]) {
    materials.insulation = await getRecordFromScan<Material>(
      getMaterials, order.materialsInsulation[0])
  } else {
    console.warn(`Order ${ref} has no associated insulation material`)
  }
  if (order.materialsFixings?.[0]) {
    materials.fixings = await getRecordFromScan<Material>(
      getMaterials, order.materialsFixings[0])
  } else {
    console.warn(`Order ${ref} has no associated fixings material`)
  }

  // FIXME: remove these logs - just for dev purposes
  console.log('order', order)
  for (const component of components) {
    console.log(`history record ${component.componentUid}:`, component)
  }
  console.log('project', project)
  console.log('block', block)
  for (const supplier of suppliers) {
    console.log(`supplier ${supplier.supplierName}`, supplier)
  }

  const mainImage = order?.mainImageCustom?.[0] || order?.mainImageFromLibrarySource?.[0]
  const modelFile = order?._3dmodelcustom || order?.githubModelDetailedFromLibrarySource
  const assemblyFile = order?.assemblyManualCustom?.[0] || order?.githubAssemblyGuideFromLibrarySource
  const cuttingFile = order?.cuttingFilesCustom || order?.githubCuttingFileFromLibrarySource
  const totalGwp = getTotalGwp(order.gwpFromMaterialsTimber, order.gwpFromMaterialsInsulation, order.sheetQuantityPerBlock)

  // much of the below is vendored from passport page - changes there should be reflected here (or abstracted into shared components)
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {project && <ReturnButton
        href={`/project/${kebabCase(project.projectName)}`}
        label={project.projectName}
      />}
      <div className="flex flex-col space-y-2">
        <h1>{order.componentName}</h1>
        <div className="flex justify-between">
          <small>#{order.orderRef.substring(0, 4)}</small>
          <Badge className={kebabCase(orderStatus)}>{orderStatus}</Badge>
        </div>
      </div>
      <Card className="relative w-full h-64 lg:h-96 flex justify-center items-center">
        {mainImage && order ? <AirtableImage
          tableId={orderBaseTable.tableId}
          recordId={order.id}
          fieldId={order?.mainImageCustom?.[0]
            ? orderBaseTable.mappings?.mainImageCustom
            : orderBaseTable.mappings?.mainImageFromLibrarySource}
          className="object-contain object-center rounded-md p-2"
          src={mainImage}
          alt={`Orthogonal diagram of ${order.componentName}`}
          unoptimized
          priority
          fill
        /> : <ImageIcon className="w-full h-16 lg:h-24 opacity-70" />
        }
      </Card>
      <Accordion type="multiple" defaultValue={['components']}>
        <AccordionItem asChild value="info">
          <section>
            <AccordionTrigger>
              <h3>Info</h3>
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableBody>
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
                  {isNotNil(order.massPerBlock) && <TableRow>
                    <TableCell className="font-medium">Mass</TableCell>
                    <TableCell className="text-right">{round(order.massPerBlock, MAX_DECIMAL_PLACE_PRECISION)} <small>kg</small></TableCell>
                  </TableRow>}
                  {isNotNil(totalGwp) && <TableRow>
                    <TableCell className="font-medium">
                      Global warming potential <small>
                        <a href="https://en.wikipedia.org/wiki/Global_warming_potential" target="_blank">(GWP)</a>
                      </small>
                    </TableCell>
                    <TableCell className="text-right">{round(totalGwp, MAX_DECIMAL_PLACE_PRECISION)}</TableCell>
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
                <TableBody>
                  {isNotNil(materials.timber) && <TableRow>
                    <TableCell>
                      <div className="relative w-6 h-6 lg:w-10 lg:h-10 flex justify-center items-center">
                        {materials.timber.thumbnail?.[0] ?
                          <AirtableImage
                            tableId={materialsTable.tableId}
                            recordId={materials.timber.id}
                            fieldId={materialsTable.mappings?.thumbnail}
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
                          <AirtableImage
                            tableId={materialsTable.tableId}
                            recordId={materials.insulation.id}
                            fieldId={materialsTable.mappings?.thumbnail}
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
                          <AirtableImage
                            tableId={materialsTable.tableId}
                            recordId={materials.fixings.id}
                            fieldId={materialsTable.mappings?.thumbnail}
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
                      <AirtableAttachmentLink
                        tableId={orderBaseTable.tableId}
                        recordId={order.id}
                        fieldId={order?.assemblyManualCustom?.[0]
                          ? orderBaseTable.mappings?.assemblyManualCustom
                          : orderBaseTable.mappings?.githubAssemblyGuideFromLibrarySource}
                        href={assemblyFile}
                        text={order?.assemblyManualCustom?.[0] ? 'Custom' : (truncate(assemblyFile.split('/').pop()) || 'Github')}
                      />
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
        <AccordionItem asChild value="components">
          <section>
            <AccordionTrigger>
              <h3>Components</h3>
            </AccordionTrigger>
            <AccordionContent>
              {components?.[0] ? (
                <Table>
                  <TableBody>
                    {components.map((component, i) => {
                      const componentStatus = getComponentStatusEnum(component.status)
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <Link href={`/passport/${component.componentUid}`}>
                              {component.componentUid}
                            </Link>
                          </TableCell>
                          {componentStatus && <TableCell className="text-right text-nowrap">
                            <Badge className={kebabCase(componentStatus)}>{componentStatus}</Badge>
                          </TableCell>}
                        </TableRow>
                      )})}
                  </TableBody>
                </Table>
              ) : <p>No components found</p> }
            </AccordionContent>
          </section>
        </AccordionItem>
      </Accordion>
      
      {/* <section>
        <div className="flex flex-col space-y-2 lg:space-y-4">
          {orderStatus === ComponentStatus.ReadyForProduction &&
          // TODO: write server action to download all labels for a given component type, and attach here as onClick
            <Button variant="default" asChild className="rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg">
              Download labels
            </Button>}
          <StatusTransitionButtons
            componentUid={uid}
            componentRecordId={component.id}
            currentComponentStatus={componentStatus as ComponentStatus}
          />
        </div>
      </section> */}

    </Suspense>
  )
}
