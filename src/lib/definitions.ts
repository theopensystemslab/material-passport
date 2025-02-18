// define types here

// this enum of possible statuses is non-exhaustive for the moment, and naming may not be final
export enum ComponentStatus {
  Feasibility = "Feasibility", // not in miro, but in dummy data
  DesignInProgress = "Design in progress",
  ReadyForProduction = "Ready for production", // aka. ReadyForManufacture (as per the miro)
  Manufactured = "Manufactured",
  InTransit = "In transit",
  ReceivedOnSite = "Received on site",
  Installed = "Installed",
  InUse = "In use",
}
