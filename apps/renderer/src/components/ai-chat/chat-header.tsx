import type { ReactNode } from 'react'
import { Kbd } from '@mrunner/ui'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ChatHeader({
	onBack,
	children,
}: {
	onBack: () => void
	children: ReactNode
}) {
	const { t } = useTranslation()
	return (
		<div
			data-slot="chat-header"
			className="flex items-center gap-2 border-border-subtle border-b bg-surface-2/60 px-3 py-2.5"
		>
			<button
				type="button"
				onClick={onBack}
				className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors duration-150 ease-out hover:bg-surface-3 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/40 motion-reduce:transition-none"
				aria-label={t('chat.back')}
			>
				<ArrowLeft className="size-4" />
				<Kbd>esc</Kbd>
			</button>
			{children}
		</div>
	)
}
