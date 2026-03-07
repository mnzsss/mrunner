import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'

i18next.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		'pt-BR': { translation: ptBR },
	},
	lng: navigator.language.startsWith('pt') ? 'pt-BR' : 'en',
	fallbackLng: 'en',
	supportedLngs: ['en', 'pt-BR'],
	interpolation: {
		escapeValue: false,
	},
})

export default i18next
