// server actions (e.g. airtable mutations) can be exported from here (for use in any component)
'use server'

import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

import { isNil } from 'es-toolkit'
import { revalidatePath } from 'next/cache'

import { getAirtableDb, getCachedScan } from '@/lib/airtable'
import { ComponentStatus, Nil } from '@/lib/definitions'
import {
  type Component,
  type Project,
  componentsTable,
  projectsTable
} from '@/lib/schema'

const getComponents = getCachedScan<Component>(componentsTable, 180)
const getProjects = getCachedScan<Project>(projectsTable)

interface DownloadLabelsOptions {
  projectName?: string | Nil;
  blockName?: string | Nil;
}

// download all labels for a given project or block type
// TODO: implement block type option
// TODO: have this func return a zipped file of all labels
export const downloadLabels = async (options: DownloadLabelsOptions): Promise<void | null> => {
  const { projectName } = options
  if (isNil(projectName)) {
    console.error('No project name provided')
    return null
  }
  console.log(`Downloading all labels for project: ${projectName}`)
  const components = await getComponents()
  const projects = await getProjects()
  for (const component of components) {
    const project = projects.find((project) => project.id === component.project?.[0])
    if (!project) {
      console.error(`Failed to find associated project for component: ${component.componentUid}`)
      continue
    }
    if (project.projectName == projectName) {
      console.log(`Downloading label for component ${component.componentUid} of project ${projectName}`)
      const res = await fetch(component.label[0])
      if (res.ok) {
        const dest = path.resolve(process.cwd(), 'tmp', `${component.componentUid}.pdf`)
        const writer = fs.createWriteStream(dest, { flags: 'wx' })
        const buffer = await res.arrayBuffer()
        Readable.from(Buffer.from(buffer)).pipe(writer)
      }
    }
  }}

export const changeComponentStatus = async (
  uid: string,
  recordId: string,
  newStatus: ComponentStatus,
): Promise<void> => {
  console.debug(`Changing status of component ${uid} to ${newStatus}`)
  const db = getAirtableDb()
  db.update(componentsTable, {
    id: recordId,
    status: newStatus,
  })
  // now we force a revalidation (cache deletion) of the relevant passport
  revalidatePath(`/passport/${uid}`)
}
