import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLocale } from '@/lib/locale-context'
import type { Language, Currency } from '@/lib/i18n'

export function LocaleToggle() {
  const { language, currency, setLanguage, setCurrency, t } = useLocale()

  const LANGUAGES: { value: Language; label: string }[] = [
    { value: 'en', label: t('common.langEnglish') },
    { value: 'fr', label: t('common.langFrench') },
    { value: 'de', label: t('common.langGerman') },
    { value: 'es', label: t('common.langSpanish') },
  ]

  const CURRENCIES: { value: Currency; label: string }[] = [
    { value: 'GBP', label: 'GBP £' },
    { value: 'USD', label: 'USD $' },
    { value: 'EUR', label: 'EUR €' },
  ]

  // Modern inline style for the tick
  const tickStyle = (isSelected: boolean) => ({
    display: 'inline-block',
    fontWeight: 'bold',
    fontSize: '18px',
    lineHeight: '1',
    color: 'var(--primary)',
    transition: 'all 0.2s ease-in-out',
    opacity: isSelected ? 1 : 0,
    transform: isSelected ? 'scale(1)' : 'scale(0.5)',
    width: '18px',
    textAlign: 'center' as const
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-5 w-5" />
          <span className="sr-only">{t('common.language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ width: '220px', zIndex: 9999 }}>
        <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLanguage(l.value)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              cursor: 'pointer',
              padding: '6px 8px'
            }}
          >
            <span style={{ fontWeight: language === l.value ? 600 : 400 }}>
              {l.label}
            </span>
            <span style={tickStyle(language === l.value)}>
              ✓
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('settings.currency')}</DropdownMenuLabel>
        {CURRENCIES.map((c) => (
          <DropdownMenuItem
            key={c.value}
            onClick={() => setCurrency(c.value)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              cursor: 'pointer',
              padding: '6px 8px'
            }}
          >
            <span style={{ fontWeight: currency === c.value ? 600 : 400 }}>
              {c.label}
            </span>
            <span style={tickStyle(currency === c.value)}>
              ✓
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}