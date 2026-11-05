import type { ScheduledRoute } from '@/lib/scheduled-routes'

/**
 * Builds a SimBrief dispatch URL with the route pre-filled.
 * SimBrief accepts query params like: orig, dest, type, airline, fltnum
 */
export function buildSimbriefUrl(route: ScheduledRoute): string {
  const params = new URLSearchParams({
    orig: route.departure,
    dest: route.arrival,
    type: route.aircraft,
    airline: route.airlineCode,
    fltnum: route.flightNumber.replace(/^[A-Z0-9]+/, '').trim() || route.flightNumber,
  })
  return `https://dispatch.simbrief.com/options/custom?${params.toString()}`
}