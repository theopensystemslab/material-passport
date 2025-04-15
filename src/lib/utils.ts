import { type ClassValue, clsx } from 'clsx'
import { round } from 'es-toolkit'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { twMerge } from 'tailwind-merge'


import {
  ComponentStatus,
  HistoryEvent,
  Nil
} from '@/lib/definitions'
import { History } from '@/lib/schema'

const FILE_EXTENSION_REGEX: RegExp = /\.[^/.]+$/
const MONTH_BY_INDEX: Record<number, string> = {
  0: 'Jan',
  1: 'Feb',
  2: 'Mar',
  3: 'Apr',
  4: 'May',
  5: 'Jun',
  6: 'Jul',
  7: 'Aug',
  8: 'Sep',
  9: 'Oct',
  10: 'Nov',
  11: 'Dec',
}

export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs))
}

// string enums don't have reverse mappings, so we build one (see https://blog.logrocket.com/typescript-enums-vs-types/)
export const ComponentStatusLookup: { [key: string]: ComponentStatus } = {
  'Design in progress': ComponentStatus.DesignInProgress,
  'Ready for production': ComponentStatus.ReadyForProduction,
  'Manufactured': ComponentStatus.Manufactured,
  'In transit': ComponentStatus.InTransit,
  'Received on site': ComponentStatus.ReceivedOnSite,
  'Installed': ComponentStatus.Installed,
  'In use': ComponentStatus.InUse,
}

interface getEnumOptions {
  shouldThrow?: boolean
}

export const getComponentStatusEnum = (
  status: string,
  { shouldThrow = false }: getEnumOptions = {}
): ComponentStatus | null => {
  if (!ComponentStatusLookup[status]) {
    const msg = `Invalid status: ${status}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  return ComponentStatusLookup[status]
}

export const HistoryEventLookup: { [key: string]: HistoryEvent } = {
  'Design completed': HistoryEvent.DesignCompleted,
  'Manufactured': HistoryEvent.Manufactured,
  'Moved': HistoryEvent.Moved,
  'Installed': HistoryEvent.Installed,
  'Record': HistoryEvent.Record,
}

export const getHistoryEventEnum = (
  event: string,
  { shouldThrow = false }: getEnumOptions = {}
): HistoryEvent | null => {
  if (!HistoryEventLookup[event]) {
    const msg = `Invalid event: ${event}`
    if (shouldThrow) throw new Error(msg)
    console.warn(msg)
    return null
  }
  return HistoryEventLookup[event]
}

// handy util for truncating long filenames without losing the extension/file type
export const truncate = (
  str: string | Nil,
  maxLength: number = 20,
): string => {
  if (!str) return ''
  if (str.length <= maxLength) return str

  const extMatch = str.match(FILE_EXTENSION_REGEX)
  if (!extMatch) {
    return str.slice(0, maxLength - 1) + '…'
  }

  const ellipsisExt = '…' + extMatch[0].slice(1)
  // handle weird/unlikely edge case where filename is shorter than extension
  const available = maxLength - ellipsisExt.length
  if (available <= 0) return ellipsisExt
  
  return str.slice(0, available) + ellipsisExt
}

interface DateFormatOptions {
  dateOnly?: boolean
  pretty?: boolean
}

// TODO: simplify (or remove) this util with a library like date-fns (https://date-fns.org/)
export const getDateReprFromEpoch = (
  epoch: number,
  {
    dateOnly = false,
    pretty = false,
  }: DateFormatOptions = {},
): string => {
  // dates from airtable come as seconds since epoch, but Date constructor expects milliseconds
  const date = new Date(epoch * 1000)
  // the result will be in UTC and we keep it that way for interoperability / i18n
  if (pretty) {
    const datePretty = `${date.getUTCDate()} ${MONTH_BY_INDEX[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    return dateOnly ? datePretty : `${datePretty}, ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`
  } else {
    const iso8601 = date.toISOString()
    return dateOnly ? iso8601.split('T')[0] : iso8601
  }
}

const pad2 = (num: number) => String(num).padStart(2, '0')

export const getLocationReprFromHistory = (history: History): string | null => {
  const { latitude, longitude } = history
  if (!latitude || !longitude) return null
  return `${round(latitude, 4)}°, ${round(longitude, 4)}°`
}

export const dekebab = (input: string): string => {
  return input
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// logic below is copied from formula for 'Total GWP' field on Components table
export const getTotalGwp = (
  gwpTimber: number | null,
  gwpInsulation: number | null,
  sheetQuantity: number | null,
) => {
  if (!gwpTimber || !gwpInsulation || !sheetQuantity) return null
  return ((gwpTimber / (1/(1.22*2.44*0.018))) * sheetQuantity) + gwpInsulation
}

export const isBuildTime = (): boolean => {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
}

// we define a generic fetcher for use with SWR
export const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`)
  }
  return res.text()
})
