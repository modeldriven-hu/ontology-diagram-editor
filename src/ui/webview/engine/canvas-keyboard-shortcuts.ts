export interface KeyboardShortcutEvent {
	readonly key: string;
	readonly altKey: boolean;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly shiftKey: boolean;
}

export function isSelectAllShortcut(event: KeyboardShortcutEvent): boolean {
	return event.key.toLowerCase() === 'a'
		&& (event.ctrlKey || event.metaKey)
		&& !event.altKey
		&& !event.shiftKey;
}
