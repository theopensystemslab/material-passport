import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { ComponentStatus, Nil } from '@/lib/definitions'

const FILE_EXTENSION_REGEX = /\.[^/.]+$/

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

export const getComponentStatusEnum = (status: string): ComponentStatus => {
  if (!ComponentStatusLookup[status]) {
    throw new Error(`Invalid status: ${status}`)
  }
  return ComponentStatusLookup[status]
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

