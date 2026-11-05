import { Globe, Check } from 'lucide-react'
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

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
]

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'GBP', label: 'GBP £' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
]

export function LocaleToggle() {
  const { language, currency, setLanguage, setCurrency, t } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-5 w-5" />
          <span className="sr-only">Language & Currency</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-[9999]">
        <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLanguage(l.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            {l.label}
            {language === l.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('settings.currency')}</DropdownMenuLabel>
        {CURRENCIES.map((c) => (
          <DropdownMenuItem
            key={c.value}
            onClick={() => setCurrency(c.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            {c.label}
            {currency === c.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}