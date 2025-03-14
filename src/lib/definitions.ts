// this enum of possible statuses is non-exhaustive for the moment, and naming may not be final
// any change here should also be reflected in the companion lookup logic in /helpers/utils.ts
export enum ComponentStatus {
  DesignInProgress = 'Design in progress',
  ReadyForProduction = 'Ready for production', // aka. ReadyForManufacture (as per the miro)
  Manufactured = 'Manufactured',
  InTransit = 'In transit',
  ReceivedOnSite = 'Received on site',
  Installed = 'Installed',
  InUse = 'In use',
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
