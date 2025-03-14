import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { ComponentStatus } from '@/lib/definitions'

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
