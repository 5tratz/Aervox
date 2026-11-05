const AIRCRAFT_FILE_PREFIXES: Array<{ prefix: string; patterns: RegExp }> = [
  { prefix: 'a320neo', patterns: /\bA20N\b|\bA320\b|A320NEO/i },
  { prefix: 'a330',    patterns: /\bA330\b|\bA333\b|\bA332\b/i },
  { prefix: 'a350',    patterns: /\bA350\b|\bA359\b|\bA35K\b/i },
  { prefix: 'b737',    patterns: /\bB737\b|\bB738\b|\bB739\b|\bB736\b|737/i },
  { prefix: 'b747',    patterns: /\bB747\b|\bB748\b|\bB744\b|747/i },
  { prefix: 'b777',    patterns: /\bB777\b|\bB77W\b|\bB772\b|\bB773\b|777/i },
  { prefix: 'b787',    patterns: /\bB787\b|\bB788\b|\bB789\b|\bB78X\b|787/i },
]

const PLACEHOLDER = '/aircraft/placeholder.svg'

export function getAircraftImage(aircraftIdentifier: string | null | undefined): string {
  if (!aircraftIdentifier) return PLACEHOLDER

  for (const { prefix, patterns } of AIRCRAFT_FILE_PREFIXES) {
    if (patterns.test(aircraftIdentifier)) {
      return `/aircraft/${prefix}.png`
    }
  }
  return PLACEHOLDER
}