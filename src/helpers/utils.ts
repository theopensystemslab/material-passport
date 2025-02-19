import { ComponentStatus } from "@/lib/definitions"

// string enums don't have reverse mappings, so we build one (see https://blog.logrocket.com/typescript-enums-vs-types/)
export const ComponentStatusLookup: { [key: string]: ComponentStatus } = {
  "Design in progress": ComponentStatus.DesignInProgress,
  "Ready for production": ComponentStatus.ReadyForProduction,
  "Manufactured": ComponentStatus.Manufactured,
  "In transit": ComponentStatus.InTransit,
  "Received on site": ComponentStatus.ReceivedOnSite,
  "Installed": ComponentStatus.Installed,
  "In use": ComponentStatus.InUse,
}

export const getComponentStatusEnum = (status: string): ComponentStatus => {
  if (!ComponentStatusLookup[status]) {
    throw new Error(`Invalid status: ${status}`);
  }
  return ComponentStatusLookup[status]
}