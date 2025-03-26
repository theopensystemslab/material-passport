// this enum of possible statuses is non-exhaustive for the moment, and naming may not be final
// any change here should also be reflected in the companion lookup logic in /helpers/utils.ts
// since the possible values are currently identical, this doubles up as an 'OrderStatus' enum
export enum ComponentStatus {
  DesignInProgress = 'Design in progress',
  ReadyForProduction = 'Ready for production', // aka. ReadyForManufacture (as per the miro)
  Manufactured = 'Manufactured',
  InTransit = 'In transit',
  ReceivedOnSite = 'Received on site',
  Installed = 'Installed',
  InUse = 'In use',
}

export enum HistoryEvent {
  DesignCompleted = 'Design completed',
  Manufactured = 'Manufactured',
  Moved = 'Moved',
  Installed = 'Installed',
  // catch-all for any other entry in the history record (i.e. user-submitted / not prompted by a status change)
  Record = 'Record',
}

// encode the possible transitions between statuses (sometimes there are multiple options)
export const STATUS_TRANSITIONS: Record<ComponentStatus, ComponentStatus[]> = {
  [ComponentStatus.DesignInProgress]: [],
  [ComponentStatus.ReadyForProduction]: [ComponentStatus.Manufactured],
  [ComponentStatus.Manufactured]: [ComponentStatus.InTransit, ComponentStatus.ReceivedOnSite],
  [ComponentStatus.InTransit]: [ComponentStatus.ReceivedOnSite],
  [ComponentStatus.ReceivedOnSite]: [ComponentStatus.Installed],
  [ComponentStatus.Installed]: [ComponentStatus.InUse],
  [ComponentStatus.InUse]: [],
}

// encode the status transition for which a given event is enscribed in the component history
// note that we we don't record an event for every possible status transition
export const EVENT_BY_NEW_STATUS: Partial<Record<ComponentStatus, HistoryEvent>> = {
  [ComponentStatus.ReadyForProduction]: HistoryEvent.DesignCompleted,
  [ComponentStatus.Manufactured]: HistoryEvent.Manufactured,
  [ComponentStatus.ReceivedOnSite]: HistoryEvent.Moved,
  [ComponentStatus.Installed]: HistoryEvent.Installed,
}

// gist some types here to build on the schema.ts file, for use in the airtable helper
// we know in practice that keys on an Item are strings - but we have to convince tsc!
export type TableMappingKeys<I> = Extract<keyof Omit<I, 'id'>, string>
export type TableMapping<I> = Record<TableMappingKeys<I>, string>
export type ReversedTableMapping<I> = Record<string, TableMappingKeys<I>>

// type utility to extract union of value types for a given typed object
export type ValueOf<T> = T[keyof T]

// type utility to consolidate nil types
export type Nil = null | undefined

// heavily redacted version of TextOptions vendored from pdfkit (because it's not exported)
export interface TextOptions {
  lineBreak?: boolean | undefined;
  width?: number | undefined;
  height?: number | undefined;
  lineGap?: number | undefined;
  wordSpacing?: number | undefined;
  characterSpacing?: number | undefined;
  underline?: boolean | undefined;
  continued?: boolean | undefined;
  align?: 'center' | 'justify' | 'left' | 'right' | undefined;
  baseline?:
      | number
      | 'svg-middle'
      | 'middle'
      | 'svg-central'
      | 'bottom'
      | 'ideographic'
      | 'alphabetic'
      | 'mathematical'
      | 'hanging'
      | 'top'
      | undefined;
}
