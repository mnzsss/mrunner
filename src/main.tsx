import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/components'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</React.StrictMode>,
)
