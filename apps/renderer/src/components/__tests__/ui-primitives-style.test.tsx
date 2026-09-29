import {
	Badge,
	Button,
	Command,
	CommandItem,
	CommandList,
	Dialog,
	DialogContent,
	Input,
	Kbd,
	Sheet,
	SheetContent,
	Tabs,
	TabsList,
	TabsTrigger,
} from '@mrunner/ui'
import { Item } from '@mrunner/ui/components/ui/item'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function slot(name: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${name}"]`)
	expect(element, name).not.toBeNull()
	return element as HTMLElement
}

describe('primitive restyle', () => {
	it('styles the command surface and the selected row with theme tokens', () => {
		render(
			<Command>
				<CommandList>
					<CommandItem value="first">First</CommandItem>
				</CommandList>
			</Command>,
		)
		expect(slot('command')).toHaveClass('bg-surface-1', 'animate-surface-in')
		expect(slot('command-item')).toHaveClass('data-selected:bg-highlight')
	})

	it('puts controls on the raised surface', () => {
		render(
			<>
				<Kbd>K</Kbd>
				<Input aria-label="field" />
				<Button variant="outline">Go</Button>
				<Badge variant="outline">tag</Badge>
				<Item variant="muted">row</Item>
				<Tabs defaultValue="a">
					<TabsList>
						<TabsTrigger value="a">A</TabsTrigger>
					</TabsList>
				</Tabs>
			</>,
		)
		expect(slot('kbd')).toHaveClass('bg-surface-2', 'border-border-subtle')
		expect(screen.getByRole('textbox', { name: 'field' })).toHaveClass(
			'bg-surface-2',
		)
		expect(screen.getByRole('button', { name: 'Go' })).toHaveClass(
			'bg-surface-2',
		)
		expect(screen.getByText('tag')).toHaveClass('bg-surface-2')
		expect(screen.getByText('row')).toHaveClass('bg-surface-2')
		expect(slot('tabs-list')).toHaveClass('bg-surface-2')
	})

	it('renders dialogs and sheets on the glass base surface', () => {
		render(
			<>
				<Dialog open>
					<DialogContent>dialog body</DialogContent>
				</Dialog>
				<Sheet open>
					<SheetContent>sheet body</SheetContent>
				</Sheet>
			</>,
		)
		expect(slot('dialog-content')).toHaveClass('bg-surface-1', 'glass')
		expect(slot('sheet-content')).toHaveClass('bg-surface-1', 'glass')
	})
})
