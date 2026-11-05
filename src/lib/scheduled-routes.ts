export interface ScheduledRoute {
  id: string
  flightNumber: string
  airline: string
  airlineCode: string
  departure: string
  arrival: string
  aircraft: string
  departureTime: string
  durationMin: number
  daysOfWeek: number[]
  network: 'short' | 'long'
  aircraftFamily: 'A320' | 'B737' | 'Widebody' | 'Turboprop' | 'Regional' | 'Other'
}

export const SCHEDULED_ROUTES: ScheduledRoute[] = [
  // --- British Airways (Short Haul) ---
  { id: 'ba101', flightNumber: 'BA304', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'LFPG', aircraft: 'A320', departureTime: '06:15', durationMin: 85, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  { id: 'ba102', flightNumber: 'BA380', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'EHAM', aircraft: 'A320', departureTime: '08:30', durationMin: 75, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  { id: 'ba103', flightNumber: 'BA458', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'LEMD', aircraft: 'A320', departureTime: '11:00', durationMin: 145, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  { id: 'ba104', flightNumber: 'BA492', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'LIRF', aircraft: 'A320', departureTime: '14:45', durationMin: 155, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  { id: 'ba105', flightNumber: 'BA326', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'LSZH', aircraft: 'A320', departureTime: '17:20', durationMin: 95, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  
  // --- British Airways (Long Haul) ---
  { id: 'ba106', flightNumber: 'BA117', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'KJFK', aircraft: 'B77W', departureTime: '08:40', durationMin: 490, daysOfWeek: [0,1,2,3,4,5,6], network: 'long', aircraftFamily: 'Widebody' },
  { id: 'ba107', flightNumber: 'BA009', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'WSSS', aircraft: 'B77W', departureTime: '21:10', durationMin: 790, daysOfWeek: [0,1,2,3,4,5,6], network: 'long', aircraftFamily: 'Widebody' },
  { id: 'ba108', flightNumber: 'BA245', airline: 'British Airways', airlineCode: 'BA', departure: 'EGLL', arrival: 'SAEZ', aircraft: 'A35K', departureTime: '22:30', durationMin: 810, daysOfWeek: [0,1,2,3,4,5,6], network: 'long', aircraftFamily: 'Widebody' },

  // --- Lufthansa ---
  { id: 'lh101', flightNumber: 'LH100', airline: 'Lufthansa', airlineCode: 'LH', departure: 'EDDF', arrival: 'EDDM', aircraft: 'A320', departureTime: '06:30', durationMin: 65, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  { id: 'lh102', flightNumber: 'LH400', airline: 'Lufthansa', airlineCode: 'LH', departure: 'EDDF', arrival: 'KJFK', aircraft: 'B748', departureTime: '10:55', durationMin: 510, daysOfWeek: [0,1,2,3,4,5,6], network: 'long', aircraftFamily: 'Widebody' },
  { id: 'lh103', flightNumber: 'LH200', airline: 'Lufthansa', airlineCode: 'LH', departure: 'EDDF', arrival: 'EDDB', aircraft: 'A320', departureTime: '15:20', durationMin: 70, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },

  // --- easyJet ---
  { id: 'u22101', flightNumber: 'U22011', airline: 'easyJet', airlineCode: 'U2', departure: 'EGKK', arrival: 'LEPA', aircraft: 'A320', departureTime: '07:00', durationMin: 135, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  { id: 'u22102', flightNumber: 'U22041', airline: 'easyJet', airlineCode: 'U2', departure: 'EGKK', arrival: 'LIRF', aircraft: 'A320', departureTime: '13:20', durationMin: 155, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
  { id: 'u22103', flightNumber: 'U22015', airline: 'easyJet', airlineCode: 'U2', departure: 'EGKK', arrival: 'LEMD', aircraft: 'A320', departureTime: '19:45', durationMin: 150, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },

  // --- Ryanair ---
  { id: 'fr101', flightNumber: 'FR101', airline: 'Ryanair', airlineCode: 'FR', departure: 'EIDW', arrival: 'EGLL', aircraft: 'B738', departureTime: '09:15', durationMin: 80, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'B737' },
  { id: 'fr102', flightNumber: 'FR202', airline: 'Ryanair', airlineCode: 'FR', departure: 'EIDW', arrival: 'LFPG', aircraft: 'B738', departureTime: '16:30', durationMin: 105, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'B737' }, 
  { id: 'fr103', flightNumber: 'FR1397', airline: 'Ryanair', airlineCode: 'FR', departure: 'EPWA', arrival: 'LEMG', aircraft: 'B38M', departureTime: '19:35', durationMin: 219, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'B737' },

  // --- Emirates ---
  { id: 'ek101', flightNumber: 'EK001', airline: 'Emirates', airlineCode: 'EK', departure: 'OMDB', arrival: 'EGLL', aircraft: 'A388', departureTime: '03:30', durationMin: 450, daysOfWeek: [0,1,2,3,4,5,6], network: 'long', aircraftFamily: 'Widebody' },
  { id: 'ek102', flightNumber: 'EK002', airline: 'Emirates', airlineCode: 'EK', departure: 'OMDB', arrival: 'KJFK', aircraft: 'A388', departureTime: '11:00', durationMin: 780, daysOfWeek: [0,1,2,3,4,5,6], network: 'long', aircraftFamily: 'Widebody' },
  
  // --- Qatar Airways ---
  { id: 'qr101', flightNumber: 'QR003', airline: 'Qatar Airways', airlineCode: 'QR', departure: 'OTHH', arrival: 'EGLL', aircraft: 'A359', departureTime: '07:45', durationMin: 420, daysOfWeek: [0,1,2,3,4,5,6], network: 'long', aircraftFamily: 'Widebody' },

  // --- Air France ---
  { id: 'af1101', flightNumber: 'AF1680', airline: 'Air France', airlineCode: 'AF', departure: 'LFPG', arrival: 'EGLL', aircraft: 'A320', departureTime: '12:30', durationMin: 80, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' }, 
  { id: 'af1102', flightNumber: 'AF1268', airline: 'Air France', airlineCode: 'AF', departure: 'LFPG', arrival: 'EGCC', aircraft: 'BCS3', departureTime: '20:55', durationMin: 87, daysOfWeek: [0,1,2,3,4,5,6], network: 'short', aircraftFamily: 'A320' },
]