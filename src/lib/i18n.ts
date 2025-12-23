export const UI_TEXT = {
	app: {
		name: 'MRunner',
		version: 'v1.0',
	},
	search: {
		placeholder: 'Digite um comando ou busque...',
		empty: 'Nenhum resultado encontrado.',
	},
	navigation: {
		navigate: 'navegar',
		select: 'selecionar',
		close: 'fechar',
	},
	bookmarks: {
		group: 'Bookmarks',
		add: 'Adicionar Bookmark',
		addDescription: 'Adicionar novo bookmark ao Buku',
		edit: 'Editar Bookmark',
		editDescription: 'Edite as informações do bookmark',
		delete: 'Deletar Bookmark?',
		deleteConfirm: 'Tem certeza que deseja deletar este bookmark?',
		noTitle: 'Sem título',
	},
	form: {
		url: 'URL',
		urlRequired: 'URL é obrigatória',
		urlInvalid: 'URL inválida. Use o formato: https://example.com',
		urlPlaceholder: 'https://example.com',
		title: 'Título',
		titlePlaceholder: 'Título do bookmark (opcional)',
		tags: 'Tags',
		tagsPlaceholder: 'tag1, tag2, tag3 (separadas por vírgula)',
		description: 'Descrição',
		descriptionPlaceholder: 'Descrição do bookmark (opcional)',
	},
	actions: {
		save: 'Salvar',
		saving: 'Salvando...',
		cancel: 'Cancelar',
		delete: 'Deletar',
		open: 'Abrir',
		openBookmark: 'Abrir bookmark',
		copy: 'Copiar URL',
		copyBookmark: 'Copiar URL do bookmark',
		editBookmark: 'Editar bookmark',
		deleteBookmark: 'Deletar bookmark',
		tryAgain: 'Tentar novamente',
	},
	errors: {
		generic: 'Algo deu errado',
		unknown: 'Erro desconhecido',
	},
	notifications: {
		added: (url: string) => `Adicionado: ${url}`,
		updated: 'Bookmark atualizado',
		deleted: 'Bookmark deletado',
		copied: (url: string) => `Copiado: ${url}`,
		copiedMarkdown: 'Copiado como Markdown',
		tagRenamed: (oldTag: string, newTag: string) =>
			`Tag renomeada: ${oldTag} → ${newTag}`,
		tagDeleted: (tag: string) => `Tag deletada: ${tag}`,
	},
} as const

export type UIText = typeof UI_TEXT
