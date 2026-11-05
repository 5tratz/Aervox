import { useState } from 'react'
import { Plane } from 'lucide-react'

// Map VATSIM callsign prefixes to your logo filenames
const AIRLINE_LOGO_MAP: Record<string, string> = {
  // --- Europe ---
  BAW: 'BA',   // British Airways
  EZY: 'U2',   // easyJet
  RYR: 'FR',   // Ryanair
  DLH: 'LH',   // Lufthansa
  AFR: 'AF',   // Air France
  KLM: 'KL',   // KLM
  VIR: 'VS',   // Virgin Atlantic
  IBE: 'IB',   // Iberia
  VLG: 'VY',   // Vueling
  SWR: 'LX',   // Swiss
  AUA: 'OS',   // Austrian Airlines
  SAS: 'SK',   // Scandinavian Airlines
  FIN: 'AY',   // Finnair
  TAP: 'TP',   // TAP Air Portugal
  ITY: 'AZ',   // ITA Airways (formerly Alitalia)
  WZZ: 'W6',   // Wizz Air
  TRA: 'HV',   // Transavia
  EIN: 'EI',   // Aer Lingus
  ROT: 'RO',   // Tarom
  LOT: 'LO',   // LOT Polish Airlines
  AEE: 'A3',   // Aegean Airlines
  BRU: 'SN',   // Brussels Airlines
  CCA: 'CA',   // Air China (sometimes flies in Europe)

  // --- North America ---
  AAL: 'AA',   // American Airlines
  DAL: 'DL',   // Delta
  UAL: 'UA',   // United
  SWA: 'WN',   // Southwest
  ACA: 'AC',   // Air Canada
  JBU: 'B6',   // JetBlue
  ASA: 'AS',   // Alaska Airlines
  WJA: 'WS',   // WestJet
  AMX: 'AM',   // Aeromexico

  // --- Middle East ---
  UAE: 'EK',   // Emirates
  QTR: 'QR',   // Qatar Airways
  ETD: 'EY',   // Etihad Airways
  SVA: 'SV',   // Saudia
  RJA: 'RJ',   // Royal Jordanian
  ELY: 'LY',   // El Al

  // --- Asia & Oceania ---
  SIA: 'SQ',   // Singapore Airlines
  CPA: 'CX',   // Cathay Pacific
  QFA: 'QF',   // Qantas
  ANA: 'NH',   // All Nippon Airways
  JAL: 'JL',   // Japan Airlines
  KAL: 'KE',   // Korean Air
  AAR: 'OZ',   // Asiana Airlines
  CES: 'MU',   // China Eastern
  CSN: 'CZ',   // China Southern
  CSZ: 'ZH',   // Shenzhen Airlines
  CHH: 'HU',   // Hainan Airlines
  EVA: 'BR',   // EVA Air
  CAL: 'CI',   // China Airlines
  THA: 'TG',   // Thai Airways
  MAS: 'MH',   // Malaysia Airlines
  SLK: 'TR',   // Scoot
  AXM: 'AK',   // AirAsia
  GIA: 'GA',   // Garuda Indonesia
  PAL: 'PR',   // Philippine Airlines
  VJC: 'VJ',   // VietJet Air
  HVN: 'VN',   // Vietnam Airlines
  AIC: 'AI',   // Air India
  IGO: '6E',   // IndiGo
  SEJ: 'SG',   // SpiceJet
  ANZ: 'NZ',   // Air New Zealand
  VOZ: 'VA',   // Virgin Australia

  // --- South America & Africa ---
  LAN: 'LA',   // LATAM
  GLO: 'G3',   // Gol Transportes Aéreos
  ARG: 'AR',   // Aerolineas Argentinas
  AVA: 'AV',   // Avianca
  ETH: 'ET',   // Ethiopian Airlines
  SAA: 'SA',   // South African Airways
  MSR: 'MS',   // EgyptAir
  RAM: 'AT',   // Royal Air Maroc
  KQA: 'KQ',   // Kenya Airways
}

export function AirlineLogo({ code, name }: { code: string; name: string }) {
  const [error, setError] = useState(false)

  // If we have a mapping (e.g. BAW -> BA), use that. Otherwise fall back to the raw code.
  const mappedCode = AIRLINE_LOGO_MAP[code.toUpperCase()] || code
  // Force .png extension
  const filename = `/companies/${mappedCode}.png`

  const handleError = () => {
    setError(true)
  }

  if (error || !code) {
    return (
      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center border border-border/50 shrink-0">
        <Plane className="h-5 w-5 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <div className="h-10 w-10 rounded bg-white flex items-center justify-center border border-border/50 overflow-hidden shrink-0 shadow-sm">
      <img
        src={filename}
        alt={name}
        className="w-full h-full object-contain"
        onError={handleError}
      />
    </div>
  )
}