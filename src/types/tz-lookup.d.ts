declare module 'tz-lookup' {
  /**
   * Returns the IANA timezone name (e.g. "Europe/London") for the given coordinates.
   * Throws if the coordinates are invalid or out of range.
   */
  export default function tzlookup(lat: number, lon: number): string
}