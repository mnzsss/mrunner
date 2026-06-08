import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
} from '@mrunner/ui'
import { FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface DirectoryPickerProps {
	onSelect: (directory: string) => void
}

export function DirectoryPicker({ onSelect }: DirectoryPickerProps) {
	const { t } = useTranslation()
	const [directory, setDirectory] = useState('')

	return (
		<div className="flex flex-1 items-center justify-center p-4">
			<Card size="sm" className="max-w-sm">
				<CardHeader>
					<div className="flex items-center gap-2">
						<FolderOpen className="size-5 text-primary" />
						<CardTitle className="text-sm">
							{t('chat.selectDirectory')}
						</CardTitle>
					</div>
					<CardDescription>
						{t('chat.selectDirectoryDescription')}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<Input
						value={directory}
						onChange={(e) => setDirectory(e.currentTarget.value)}
						placeholder={t('chat.directoryPlaceholder')}
						autoFocus
						onKeyDown={(e) => {
							if (e.key === 'Enter' && directory.trim()) {
								onSelect(directory.trim())
							}
						}}
					/>
					<button
						type="button"
						disabled={!directory.trim()}
						onClick={() => onSelect(directory.trim())}
						className="w-full cursor-pointer rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm transition-all duration-150 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					>
						{t('chat.startChat')}
					</button>
				</CardContent>
			</Card>
		</div>
	)
}
