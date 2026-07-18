import type { IconGallerySet } from '../../../shared/icon-gallery';
import { createEmbeddedGalleryIcon, defaultGalleryIconColor } from '../../../shared/embedded-gallery-icon';

export interface IconGalleryDialogRequest {
	readonly title: string;
	readonly onIconSelected: (source: string) => void;
	readonly onFileSelected: () => void;
	readonly initialColor?: string;
}

interface IconifyIconData {
	readonly body: string;
	readonly width?: number;
	readonly height?: number;
}

interface IconifyCollection {
	readonly prefix: string;
	readonly icons: Readonly<Record<string, IconifyIconData>>;
	readonly width?: number;
	readonly height?: number;
}

const maximumVisibleIcons = 240;

/** A searchable, keyboard-dismissible gallery for bundled offline icon sets. */
export class IconGalleryDialog {
	private readonly overlay: HTMLDivElement;
	private readonly title: HTMLHeadingElement;
	private readonly setSelect: HTMLSelectElement;
	private readonly searchInput: HTMLInputElement;
	private readonly colorInput: HTMLInputElement;
	private readonly resultSummary: HTMLSpanElement;
	private readonly gallery: HTMLDivElement;
	private readonly license: HTMLSpanElement;
	private readonly collectionCache = new Map<string, Promise<IconifyCollection>>();
	private request: IconGalleryDialogRequest | undefined;
	private activeCollection: IconifyCollection | undefined;
	private loadRevision = 0;

	public constructor(private readonly sets: readonly IconGallerySet[]) {
		installStyles();
		this.overlay = document.createElement('div');
		this.overlay.className = 'icon-gallery-overlay';
		this.overlay.hidden = true;
		this.overlay.setAttribute('role', 'presentation');
		const dialog = document.createElement('section');
		dialog.className = 'icon-gallery-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.setAttribute('aria-labelledby', 'iconGalleryTitle');
		const header = document.createElement('header');
		header.className = 'icon-gallery-header';
		this.title = document.createElement('h2');
		this.title.id = 'iconGalleryTitle';
		const closeButton = document.createElement('button');
		closeButton.className = 'icon-gallery-close';
		closeButton.type = 'button';
		closeButton.textContent = 'Close';
		closeButton.addEventListener('click', () => this.close());
		header.append(this.title, closeButton);
		const intro = document.createElement('p');
		intro.className = 'icon-gallery-intro';
		intro.textContent = 'Choose from three bundled open-source icon sets, or embed an image file from your computer.';
		const controls = document.createElement('div');
		controls.className = 'icon-gallery-controls';
		this.setSelect = document.createElement('select');
		this.setSelect.className = 'icon-gallery-set-select';
		this.setSelect.setAttribute('aria-label', 'Icon set');
		for (const set of sets) {
			const option = document.createElement('option');
			option.value = set.id;
			option.textContent = `${set.name} (${set.total.toLocaleString()})`;
			this.setSelect.appendChild(option);
		}
		this.setSelect.addEventListener('change', () => void this.loadSelectedCollection());
		this.searchInput = document.createElement('input');
		this.searchInput.className = 'icon-gallery-search';
		this.searchInput.type = 'search';
		this.searchInput.placeholder = 'Search icons';
		this.searchInput.setAttribute('aria-label', 'Search icon gallery');
		this.searchInput.addEventListener('input', () => this.renderIcons());
		const colorControl = document.createElement('label');
		colorControl.className = 'icon-gallery-color-control';
		const colorLabel = document.createElement('span');
		colorLabel.textContent = 'Color';
		this.colorInput = document.createElement('input');
		this.colorInput.type = 'color';
		this.colorInput.value = defaultGalleryIconColor;
		this.colorInput.setAttribute('aria-label', 'Icon color');
		this.colorInput.addEventListener('input', () => this.renderIcons());
		colorControl.append(colorLabel, this.colorInput);
		controls.append(this.setSelect, this.searchInput, colorControl);
		this.resultSummary = document.createElement('span');
		this.resultSummary.className = 'icon-gallery-result-summary';
		this.resultSummary.setAttribute('aria-live', 'polite');
		this.gallery = document.createElement('div');
		this.gallery.className = 'icon-gallery-grid';
		const footer = document.createElement('footer');
		footer.className = 'icon-gallery-footer';
		const fileButton = document.createElement('button');
		fileButton.className = 'icon-gallery-file-button';
		fileButton.type = 'button';
		fileButton.textContent = 'Choose image file…';
		fileButton.addEventListener('click', () => {
			const request = this.request;
			this.close();
			request?.onFileSelected();
		});
		this.license = document.createElement('span');
		footer.append(fileButton, this.license);
		dialog.append(header, intro, controls, this.resultSummary, this.gallery, footer);
		this.overlay.appendChild(dialog);
		this.overlay.addEventListener('mousedown', (event) => {
			if (event.target === this.overlay) {
				this.close();
			}
		});
		document.body.appendChild(this.overlay);
		document.addEventListener('keydown', (event) => {
			if (!this.overlay.hidden && event.key === 'Escape') {
				event.preventDefault();
				this.close();
			}
		});
	}

	public open(request: IconGalleryDialogRequest): void {
		this.request = request;
		this.title.textContent = request.title;
		this.searchInput.value = '';
		this.colorInput.value = request.initialColor ?? defaultGalleryIconColor;
		this.overlay.hidden = false;
		void this.loadSelectedCollection();
		this.searchInput.focus();
	}

	private close(): void {
		this.overlay.hidden = true;
		this.request = undefined;
	}

	private async loadSelectedCollection(): Promise<void> {
		const set = this.selectedSet();
		const revision = ++this.loadRevision;
		this.activeCollection = undefined;
		this.gallery.textContent = '';
		this.resultSummary.textContent = `Loading ${set?.name ?? 'icon set'}…`;
		this.license.textContent = set === undefined ? '' : `${set.name} · ${set.license} · ${set.author}`;
		if (set === undefined) {
			return;
		}

		try {
			let collectionPromise = this.collectionCache.get(set.id);
			if (collectionPromise === undefined) {
				collectionPromise = fetchIconCollection(set.uri);
				this.collectionCache.set(set.id, collectionPromise);
			}
			const collection = await collectionPromise;
			if (revision !== this.loadRevision) {
				return;
			}
			this.activeCollection = collection;
			this.searchInput.placeholder = `Search ${set.name}`;
			this.renderIcons();
		} catch (error: unknown) {
			this.collectionCache.delete(set.id);
			if (revision === this.loadRevision) {
				this.resultSummary.textContent = `Could not load ${set.name}: ${error instanceof Error ? error.message : String(error)}`;
			}
		}
	}

	private selectedSet(): IconGallerySet | undefined {
		return this.sets.find((set) => set.id === this.setSelect.value) ?? this.sets[0];
	}

	private renderIcons(): void {
		const collection = this.activeCollection;
		if (collection === undefined) {
			return;
		}
		this.gallery.textContent = '';
		const queryParts = this.searchInput.value.trim().toLocaleLowerCase().split(/\s+/).filter((part) => part !== '');
		const matchingNames = Object.keys(collection.icons).filter((name) => {
			const searchableName = name.replaceAll('-', ' ');
			return queryParts.every((part) => searchableName.includes(part));
		});
		const visibleNames = matchingNames.slice(0, maximumVisibleIcons);
		this.resultSummary.textContent = matchingNames.length > maximumVisibleIcons
			? `Showing the first ${maximumVisibleIcons.toLocaleString()} of ${matchingNames.length.toLocaleString()} matches — refine your search to narrow the results.`
			: `${matchingNames.length.toLocaleString()} icon${matchingNames.length === 1 ? '' : 's'}`;

		for (const name of visibleNames) {
			const icon = collection.icons[name];
			if (icon === undefined) {
				continue;
			}
			const source = embeddedIconSource(collection, icon, this.colorInput.value);
			const button = document.createElement('button');
			button.className = 'icon-gallery-card';
			button.type = 'button';
			button.title = name;
			const image = document.createElement('img');
			image.src = source;
			image.alt = '';
			const label = document.createElement('span');
			label.textContent = displayIconName(name);
			button.append(image, label);
			button.addEventListener('click', () => {
				const request = this.request;
				this.close();
				request?.onIconSelected(source);
			});
			this.gallery.appendChild(button);
		}
		if (matchingNames.length === 0) {
			const empty = document.createElement('p');
			empty.className = 'icon-gallery-empty';
			empty.textContent = 'No icons match your search.';
			this.gallery.appendChild(empty);
		}
	}
}

async function fetchIconCollection(uri: string): Promise<IconifyCollection> {
	const response = await fetch(uri);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	const value: unknown = await response.json();
	if (!isIconCollection(value)) {
		throw new Error('invalid icon-set data');
	}
	return value;
}

function isIconCollection(value: unknown): value is IconifyCollection {
	if (typeof value !== 'object' || value === null || !('prefix' in value) || !('icons' in value)) {
		return false;
	}
	return typeof value.prefix === 'string' && typeof value.icons === 'object' && value.icons !== null;
}

function embeddedIconSource(collection: IconifyCollection, icon: IconifyIconData, color: string): string {
	const width = icon.width ?? collection.width ?? 16;
	const height = icon.height ?? collection.height ?? 16;
	return createEmbeddedGalleryIcon(icon.body, width, height, color);
}

function displayIconName(name: string): string {
	const value = name.replaceAll('-', ' ').replaceAll('_', ' ');
	return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function installStyles(): void {
	if (document.getElementById('icon-gallery-dialog-styles') !== null) {
		return;
	}
	const style = document.createElement('style');
	style.id = 'icon-gallery-dialog-styles';
	style.textContent = `
		.icon-gallery-overlay { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 24px; background: rgb(0 0 0 / 48%); }
		.icon-gallery-overlay[hidden] { display: none; }
		.icon-gallery-dialog { display: flex; flex-direction: column; width: min(860px, 100%); max-height: min(780px, 100%); overflow: hidden; border: 1px solid var(--vscode-focusBorder); border-radius: 10px; background: var(--vscode-editor-background); color: var(--vscode-foreground); box-shadow: 0 18px 54px rgb(0 0 0 / 40%); }
		.icon-gallery-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 8px; }
		.icon-gallery-header h2 { margin: 0; font-size: 16px; }
		.icon-gallery-close, .icon-gallery-file-button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); font: inherit; cursor: pointer; }
		.icon-gallery-close { padding: 5px 9px; }
		.icon-gallery-intro { margin: 0; padding: 0 20px 14px; color: var(--vscode-descriptionForeground); font-size: 12px; }
		.icon-gallery-controls { display: grid; grid-template-columns: minmax(190px, .65fr) minmax(240px, 1.35fr) auto; gap: 8px; padding: 0 20px 8px; }
		.icon-gallery-search, .icon-gallery-set-select { min-width: 0; padding: 8px 10px; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: inherit; }
		.icon-gallery-search:focus, .icon-gallery-set-select:focus { border-color: var(--vscode-focusBorder); outline: none; }
		.icon-gallery-color-control { display: flex; align-items: center; gap: 7px; padding-left: 4px; color: var(--vscode-descriptionForeground); font-size: 12px; }
		.icon-gallery-color-control input { width: 36px; height: 34px; padding: 2px; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; background: var(--vscode-input-background); cursor: pointer; }
		.icon-gallery-result-summary { min-height: 18px; padding: 0 20px 8px; color: var(--vscode-descriptionForeground); font-size: 11px; }
		.icon-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(102px, 1fr)); gap: 8px; overflow: auto; padding: 0 20px 20px; }
		.icon-gallery-card { display: flex; min-height: 86px; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 8px; overflow: hidden; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: color-mix(in srgb, var(--vscode-editorWidget-background) 80%, transparent); color: var(--vscode-foreground); font: inherit; font-size: 11px; cursor: pointer; }
		.icon-gallery-card:hover, .icon-gallery-card:focus-visible { border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder) 14%, var(--vscode-editorWidget-background)); outline: none; }
		.icon-gallery-card img { width: 31px; height: 31px; }
		.icon-gallery-card span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.icon-gallery-empty { grid-column: 1 / -1; margin: 24px 0; color: var(--vscode-descriptionForeground); text-align: center; }
		.icon-gallery-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 11px; }
		.icon-gallery-file-button { padding: 7px 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
		.icon-gallery-file-button:hover, .icon-gallery-file-button:focus-visible { background: var(--vscode-button-hoverBackground); outline: 1px solid var(--vscode-focusBorder); }
		@media (max-width: 540px) { .icon-gallery-controls { grid-template-columns: 1fr; } .icon-gallery-footer { align-items: flex-start; flex-direction: column; } }
	`;
	document.head.appendChild(style);
}
