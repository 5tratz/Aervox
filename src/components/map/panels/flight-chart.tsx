import { useMemo } from 'react'
import { Area, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Line, ComposedChart } from 'recharts'
import { useLocale } from '@/lib/locale-context'

interface FlightChartProps {
  track: { lat: number; lon: number; alt: number; spd: number; time: number }[]
  currentAlt: number
  currentSpd: number
}

export function FlightChart({ track, currentAlt, currentSpd }: FlightChartProps) {
  const { t } = useLocale()

  // Format the data for the chart
  const data = useMemo(() => {
    if (!track || track.length === 0) return []
    
    const combined = [...track]
    const last = combined[combined.length - 1]
    
    // Ensure the current live position is always appended
    if (!last || Math.abs(last.alt - currentAlt) > 10 || Math.abs(last.spd - currentSpd) > 5) {
      combined.push({ lat: 0, lon: 0, alt: currentAlt, spd: currentSpd, time: Date.now() })
    }

    return combined.map((point) => {
      const d = new Date(point.time || Date.now())
      return {
        timeLabel: `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}Z`,
        alt: point.alt,
        spd: point.spd,
        // Simulating ground elevation as a small blocky value so it renders on the chart like the image
        elevation: 500, 
      }
    })
  }, [track, currentAlt, currentSpd])

  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/10">
        {t('chart.gathering')}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-border p-3 shadow-sm h-48 w-full flex flex-col">
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-1.5 bg-blue-500 rounded-sm" /> 
          {t('chart.groundSpeed')}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-1.5 bg-amber-700 rounded-sm" /> 
          {t('chart.groundElev')}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-1.5 bg-indigo-600 rounded-sm" /> 
          {t('chart.altitude')}
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#78350f" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#78350f" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} vertical={false} />
            <XAxis 
              dataKey="timeLabel" 
              tick={{ fontSize: 9, fill: '#888' }} 
              tickMargin={5}
              minTickGap={30}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 9, fill: '#888' }}
              tickFormatter={(val) => val === 0 ? '0' : `${(val/1000).toFixed(0)}k`}
              domain={[0, 'dataMax + 2000']}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 9, fill: '#888' }}
              domain={[0, 600]}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px', fontSize: '11px' }}
              itemStyle={{ color: '#e5e7eb' }}
              labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
            />
            
            <Area 
              yAxisId="right"
              type="step" 
              dataKey="elevation" 
              stroke="#78350f" 
              fillOpacity={1} 
              fill="url(#colorElev)" 
              isAnimationActive={false}
            />
            
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="alt" 
              stroke="#4f46e5" 
              strokeWidth={1.5}
              fillOpacity={1} 
              fill="url(#colorAlt)" 
              isAnimationActive={false}
            />
            
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="spd" 
              stroke="#3b82f6" 
              strokeWidth={1.5} 
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}