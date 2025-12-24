import { homeDir } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { UserPreferencesSchema } from '@/commands/types'

import App from './App'
import { ErrorBoundary } from './components/error-boundary'
import { Settings } from './pages/settings'
import { Setup } from './pages/setup'

function SetupGuard({ children }: { children: React.ReactNode }) {
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

				setSetupCompleted(result.success && result.data.setupCompleted)
			} catch {
				setSetupCompleted(false)
			}
		}

		checkSetup()
	}, [])

	if (setupCompleted === null) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Carregando...</p>
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
					<Route path="/settings" element={<Settings />} />
				</Routes>
			</BrowserRouter>
		</ErrorBoundary>
	</React.StrictMode>,
)
