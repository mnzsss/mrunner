import { Component, type ErrorInfo, type ReactNode } from 'react'
import { UI_TEXT } from '@/lib/i18n'

interface Props {
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

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		const errorLog = createErrorLog(error, errorInfo)

		console.error('[ErrorBoundary] Uncaught error:', errorLog)
	}

	render(): ReactNode {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}

			return (
				<div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
					<h1 className="text-xl font-semibold">{UI_TEXT.errors.generic}</h1>
					<p className="text-sm text-muted-foreground">
						{this.state.error?.message ?? UI_TEXT.errors.unknown}
					</p>
					<button
						type="button"
						onClick={() => this.setState({ hasError: false, error: null })}
						className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
					>
						{UI_TEXT.actions.tryAgain}
					</button>
				</div>
			)
		}

		return this.props.children
	}
}
