import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@mrunner/ui'

import { useLocale } from '@/hooks/use-locale'

const LANGUAGE_ITEMS = [
	{ value: 'en', label: 'English' },
	{ value: 'pt-BR', label: 'Português (BR)' },
]

export function LanguageSelector() {
	const { locale, changeLocale } = useLocale()

	const handleChange = (value: string | null) => {
		if (value) changeLocale(value)
	}

	return (
		<Select value={locale} onValueChange={handleChange} items={LANGUAGE_ITEMS}>
			<SelectTrigger>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{LANGUAGE_ITEMS.map((lang) => (
					<SelectItem key={lang.value} value={lang.value}>
						{lang.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
