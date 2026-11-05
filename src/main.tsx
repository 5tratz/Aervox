import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ThemeProvider } from '@/components/theme-provider'
import { LocaleProvider } from '@/lib/locale-context'
import { BackgroundProvider } from '@/lib/background-context'
import { SimConnectProvider } from '@/lib/simconnect-context'
import { SimbriefProvider } from '@/lib/simbrief-context'
import { PilotProvider } from '@/lib/pilot-context'
import { FlightLogProvider } from '@/lib/flight-log-context'
import { FlightLogger } from '@/lib/flight-logger'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LocaleProvider>
        <BackgroundProvider>
          <SimConnectProvider>
            <SimbriefProvider>
              <PilotProvider>
                <FlightLogProvider>
                  <FlightLogger />
                  <App />
                </FlightLogProvider>
              </PilotProvider>
            </SimbriefProvider>
          </SimConnectProvider>
        </BackgroundProvider>
      </LocaleProvider>
    </ThemeProvider>
  </React.StrictMode>,
)