import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import App from './App'
import { ErrorBoundary } from './components/error-boundary'
import { Settings } from './pages/Settings'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<App />} />
					<Route path="/settings" element={<Settings />} />
				</Routes>
			</BrowserRouter>
		</ErrorBoundary>
	</React.StrictMode>,
)
