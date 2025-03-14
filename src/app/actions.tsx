// server actions (e.g. airtable mutations) can be exported from here (for use in any component)
'use server'

import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

import { isNil } from 'es-toolkit'

import { getCachedScan } from '@/lib/airtable'
import { Nil } from '@/lib/definitions'
import {
  type Component,
  type Project,
  componentsTable,
  projectsTable
} from '@/lib/schema'

const getComponents = getCachedScan<Component>(componentsTable, 180)
const getProjects = getCachedScan<Project>(projectsTable)

export const downloadLabels = async (projectName: string | Nil): Promise<void | null> => {
  if (isNil(projectName)) {
    console.error('No project name provided')
    return null
  }
  console.log(`Downloading all labels for project: ${projectName}`)
  // kick off cached scans
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
