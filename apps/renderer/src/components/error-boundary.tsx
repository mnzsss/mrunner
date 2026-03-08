import { Component, type ErrorInfo, type ReactNode } from 'react'
import { type WithTranslation, withTranslation } from 'react-i18next'

import { createLogger } from '@/lib/logger'
import { Sentry } from '@/lib/sentry'

const logger = createLogger('error-boundary')

interface Props extends WithTranslation {
	children: ReactNode
	fallback?: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
}

interface ErrorLog {
	timestamp: string
	error: {
		name: string
		message: string
		stack?: string
	}
	componentStack?: string
	userAgent: string
	url: string
}

function createErrorLog(error: Error, errorInfo: ErrorInfo): ErrorLog {
	return {
		timestamp: new Date().toISOString(),
		error: {
			name: error.name,
			message: error.message,
			stack: error.stack,
		},
		componentStack: errorInfo.componentStack ?? undefined,
		userAgent: navigator.userAgent,
		url: window.location.href,
	}
}

class ErrorBoundaryInner extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		const errorLog = createErrorLog(error, errorInfo)

		logger.error('Uncaught error', { error: String(errorLog.error.message) })

		Sentry.withScope((scope) => {
			scope.setTag('error.boundary', 'true')
			scope.setExtra('componentStack', errorInfo.componentStack)
			scope.setExtra('errorLog', errorLog)
			Sentry.captureException(error)
		})
	}

	render(): ReactNode {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}

			const { t } = this.props

			return (
				<div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
					<h1 className="text-xl font-semibold">{t('errors.generic')}</h1>
					<p className="text-sm text-muted-foreground">
						{this.state.error?.message ?? t('errors.unknown')}
					</p>
					<button
						type="button"
						onClick={() => this.setState({ hasError: false, error: null })}
						className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
					>
						{t('actions.tryAgain')}
					</button>
				</div>
			)
		}

		return this.props.children
	}
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner)
