// server actions (e.g. airtable mutations) can be exported from here (for use in any component)
'use server'

import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

import { put } from '@vercel/blob'
import { isNil } from 'es-toolkit'
import { customAlphabet } from 'nanoid/non-secure'
import { alphanumeric } from 'nanoid-dictionary'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  getAirtableDb,
  getComponents,
  getProjects,
  getRawAirtableBase,
} from '@/lib/airtable'
import {
  ComponentStatus,
  EVENT_BY_NEW_STATUS,
  HistoryEvent,
  Nil,
} from '@/lib/definitions'
import { componentsTable, historyTable } from '@/lib/schema'

const PHOTO_BLOB_FOLDER = process.env.NEXT_PUBLIC_PHOTO_BLOB_FOLDER

interface DownloadLabelsOptions {
  projectName?: string | Nil;
  blockName?: string | Nil;
}

// download all labels for a given project or block type
// TODO: implement block type option
// TODO: have this func return a zipped file of all labels
export const downloadLabelsAction = async (options: DownloadLabelsOptions): Promise<void | null> => {
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

export const changeComponentStatusAction = async (
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
  // in some cases we will also add a record to the history table
  const event = EVENT_BY_NEW_STATUS[newStatus]
  if (event) {
    const db = getAirtableDb()
    db.insert(historyTable, {
      component: [recordId],
      event: event,
    })
  }
  // now we revalidate (delete cache) of the relevant passport, and redirect the user to force a refresh
  const path = `/passport/${uid}`
  revalidatePath(path)
  redirect(path)
}

interface PartialHistoryRecord {
  Component: string[],
  Event: HistoryEvent,
  Description: string,
  Photo?: { url: string }[]
}

// server action for handling form submissions in the 'add record' dialog on passport page
export const addHistoryRecordAction = async (formData: FormData): Promise<void> => {
  // we can be very confident that this record ID is passed through (no airtable record would return without it)
  const componentId = formData.get('componentId') as string
  const componentUid = formData.get('componentUid')
  const description = formData.get('description')?.toString() || ''
  // if we have an image, we need to buffer it and send to blob store, to then upload to airtable
  // photo will be streamed through as data:image strings in base64, i.e. as a string
  // exception is when client is mobile (or we detect as such), but browser cannot handle capture, so it's a file upload
  const photoMobile = formData.get('photoMobile') as File | string | null
  const photoDesktopBase64 = formData.get('photoDesktop') as string | null
  const dataImageUri = photoMobile ?? photoDesktopBase64
  
  let fileBuffer: Buffer<ArrayBuffer> | null = null
  // if `photoMobile` is a File, read it into a Buffer
  if (photoMobile && photoMobile instanceof File && photoMobile.size > 0) {
    console.debug(`Captured photo as a File from a mobile device: ${photoMobile.name}`)
    const arrayBuffer = await photoMobile.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
  } else if (typeof dataImageUri === 'string') {
    console.debug(`Captured photo as a base64 data URI from a ${photoMobile ? 'mobile' : 'desktop'} device`)
    const base64Data = dataImageUri.replace(/^data:image\/png;base64,/, '')
    fileBuffer = Buffer.from(base64Data, 'base64')
  } else {
    if (!description) {
      console.warn('No description or photo captured for new record - not proceeding with upload')
      return
    } else {
      console.debug('No photo captured - proceeding without')
    }
  }
  
  let blobUrl: string | null = null
  if (fileBuffer) {
    try {
      // we just need a short random string to ensure temporary unique filenames (does not need to be crypto-secure)
      const nanoid = customAlphabet(alphanumeric, 6)
      const filename = `${componentUid}-${nanoid()}.png`
      console.debug(`Attempting to upload ${filename} of length ${fileBuffer.length} to blob store`)
      const pngBlob = await put(
        `${PHOTO_BLOB_FOLDER}/${filename}`,
        fileBuffer,
        { access: 'public' }
      )
      blobUrl = pngBlob.url
      console.debug(
        `Photo for new record on component ${componentUid} uploaded to blob store: ${blobUrl}`
      )
    } catch (error) {
      console.error('Error during blob upload:', error)
      throw error
    }
  }

  // as we've discovered, we have to use raw airtable sdk to insert attachments
  const table = getRawAirtableBase()(historyTable.tableId)
  const recordData: PartialHistoryRecord = {
    Component: [componentId],
    Event: HistoryEvent.Record,
    Description: description,
  }
  // only include the photo if it exists
  if (blobUrl) {
    recordData['Photo'] = [{
      'url': blobUrl,
    }]
  }
  // @ts-expect-error: see sync-orders.ts
  table.create([{fields: recordData}])
  console.log(`New history record for component ${componentUid}`)

  const path = `/passport/${componentUid}`
  revalidatePath(path)
  redirect(path)
}
