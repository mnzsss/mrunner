import { attachConsole } from '@tauri-apps/plugin-log'

import { initSentry } from '@/lib/sentry'

initSentry()
attachConsole()

import '@/lib/i18n'

import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { homeDir } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import i18next from 'i18next'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { UserPreferencesSchema } from '@/commands/types'

import App from './App'
import { ErrorBoundary } from './components/error-boundary'
import { Setup } from './pages/setup'

function SetupGuard({ children }: { children: React.ReactNode }) {
	const { t } = useTranslation()
	const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null)

	useEffect(() => {
		const checkSetup = async () => {
			try {
				const home = await homeDir()
				// Use separate config directory in development
				const configDirName = import.meta.env.DEV ? 'mrunner-dev' : 'mrunner'
				const configPath = `${home}/.config/${configDirName}/preferences.json`
				const configExists = await exists(configPath)

				if (!configExists) {
					setSetupCompleted(false)
					return
				}

				const content = await readTextFile(configPath)
				const json: unknown = JSON.parse(content)
				const result = UserPreferencesSchema.safeParse(json)

				if (result.success) {
					// Load persisted locale
					if (result.data.locale) {
						await i18next.changeLanguage(result.data.locale)
					}
					setSetupCompleted(result.data.setupCompleted)
				} else {
					setSetupCompleted(false)
				}
			} catch {
				setSetupCompleted(false)
			}
		}

		checkSetup()
	}, [])

	if (setupCompleted === null) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">{t('app.loading')}</p>
			</div>
		)
	}

	if (!setupCompleted) {
		return <Navigate to="/setup" replace />
	}

	return <>{children}</>
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<ErrorBoundary>
			<HotkeysProvider>
				<BrowserRouter>
					<Routes>
						<Route path="/setup" element={<Setup />} />
						<Route
							path="/"
							element={
								<SetupGuard>
									<App />
								</SetupGuard>
							}
						/>
					</Routes>
				</BrowserRouter>
			</HotkeysProvider>
		</ErrorBoundary>
	</React.StrictMode>,
)
