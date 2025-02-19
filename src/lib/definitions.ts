// this enum of possible statuses is non-exhaustive for the moment, and naming may not be final
// any change here should also be reflected in the companion lookup logic in /helpers/utils.ts
export enum ComponentStatus {
  DesignInProgress = "Design in progress",
  ReadyForProduction = "Ready for production", // aka. ReadyForManufacture (as per the miro)
  Manufactured = "Manufactured",
  InTransit = "In transit",
  ReceivedOnSite = "Received on site",
  Installed = "Installed",
  InUse = "In use",
}
