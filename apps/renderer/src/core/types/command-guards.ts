import type {
	CommandAction,
	DialogAction,
	FunctionAction,
	InputAction,
	OpenAction,
	ScriptableAction,
	ShellAction,
	SubmenuAction,
	UrlAction,
} from './command'

export function isShellAction(action: CommandAction): action is ShellAction {
	return action.type === 'shell'
}

export function isOpenAction(action: CommandAction): action is OpenAction {
	return action.type === 'open'
}

export function isUrlAction(action: CommandAction): action is UrlAction {
	return action.type === 'url'
}

export function isFunctionAction(
	action: CommandAction,
): action is FunctionAction {
	return action.type === 'function'
}

export function isSubmenuAction(
	action: CommandAction,
): action is SubmenuAction {
	return action.type === 'submenu'
}

export function isInputAction(action: CommandAction): action is InputAction {
	return action.type === 'input'
}

export function isDialogAction(action: CommandAction): action is DialogAction {
	return action.type === 'dialog'
}

export function isScriptableAction(
	action: CommandAction,
): action is ScriptableAction {
	return action.type === 'scriptable'
}
