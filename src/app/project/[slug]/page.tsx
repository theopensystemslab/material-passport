import { isNotNil, kebabCase } from 'es-toolkit'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JSX } from 'react'

import { ReturnButton } from '@/components/ReturnButton'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import {
  getComponents,
  getOrders,
  getProjectFieldName,
  getProjects,
  getRecordFromScan,
} from '@/lib/airtable'
import {
  type Component,
  type OrderBase,
  type Project,
  projectsTable
} from '@/lib/schema'
import { dekebab, shouldShowRecord } from '@/lib/utils'

export const revalidate = 7200

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const projects = await getProjects()
  return projects
    .filter((project) => isNotNil(project.projectName) && shouldShowRecord(project))
    .map((project) => ({ slug: kebabCase(project.projectName) }))
}

export default async function Page({params}: {
  params: Promise<{
    slug: string
  }>
}): Promise<JSX.Element> {
  const { slug } = await Promise.resolve(params)
  const projectName = dekebab(slug)
  const projectNameFieldName = getProjectFieldName(projectsTable.mappings?.projectName)

  let project: Project | null = null
  let components: Component[] = []
  let orders: OrderBase[] = []
  try {
    project = await getRecordFromScan<Project>(getProjects, projectName, projectNameFieldName)
    components = await getComponents()
    orders = await getOrders()
  } catch (error) {
    const msg = `Failed to fetch project ${projectName} - ${error}`
    console.error(msg)
    throw new Error(msg)
  }

  if (!project || !shouldShowRecord(project)) {
    console.warn(`Project ${projectName} not found - returning 404`)
    notFound()
  }
  
  const seenComponentTypes = new Set<string>()
  return <>
    <ReturnButton href="/project" label="Choose another project" />
    <h2 className="p-4">
      {projectName}
    </h2>
    <Table>
      <TableBody>
        {components.map((component, i) => {
          if (project && component.project?.[0] === project.id) {
            const componentType = component.componentName
            if (!componentType || seenComponentTypes.has(componentType)) return null
            seenComponentTypes.add(componentType)
            const order = orders.find((order) => order.id === component.orderBase?.[0])
            return (order &&
              <TableRow key={i}>
                <TableCell>
                  <Link href={`/project/${slug}/${order.orderRef}`}>
                    {componentType}
                  </Link>
                </TableCell>
                {/* TODO: replace quantity with some graphic (e.g. tiny pie chart) representing spread of current statuses */}
                <TableCell className="text-right text-nowrap">{order?.quantity}</TableCell>
              </TableRow>
            )}})}
      </TableBody>
    </Table>
    {/* TODO: make this button work (i.e. download a zip of all labels) */}
    {/* <Button variant="default" className="rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg">
      Download labels
    </Button> */}
  </>
}
