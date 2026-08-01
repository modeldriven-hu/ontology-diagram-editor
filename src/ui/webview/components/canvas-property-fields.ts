import type { CanvasColorSwatch } from './canvas-color-palettes';

export function readonlyField(label: string, value: string): HTMLElement {
	const field = fieldElement(label);
	const valueElement = document.createElement('span');
	valueElement.className = 'property-value';
	valueElement.textContent = value;
	field.appendChild(valueElement);

	return field;
}

export function numberField(label: string, value: number, commit: (value: number) => void): HTMLElement {
	const input = document.createElement('input');
	input.className = 'property-input';
	input.type = 'number';
	input.value = String(value);
	registerCommit(input, () => {
		const nextValue = Number(input.value);
		if (Number.isFinite(nextValue)) {
			commit(nextValue);
		}
	});

	return editableField(label, input);
}

export function optionalNumberField(label: string, value: number | undefined, commit: (value: number | undefined) => void): HTMLElement {
	const input = document.createElement('input');
	input.className = 'property-input';
	input.type = 'number';
	input.value = value === undefined ? '' : String(value);
	registerOptionalNumberCommit(input, commit);

	return editableField(label, input);
}

export function optionalNumberComboField(
	label: string,
	value: number | undefined,
	options: readonly number[],
	commit: (value: number | undefined) => void,
): HTMLElement {
	const input = document.createElement('input');
	input.className = 'property-input';
	input.type = 'number';
	input.value = value === undefined ? '' : String(value);
	const list = document.createElement('datalist');
	list.id = `property-number-options-${nextGeneratedId()}`;
	for (const option of options) {
		const optionElement = document.createElement('option');
		optionElement.value = String(option);
		list.appendChild(optionElement);
	}
	input.setAttribute('list', list.id);
	registerOptionalNumberCommit(input, commit);
	const wrapper = document.createElement('span');
	wrapper.className = 'property-combo-field';
	wrapper.append(input, list);

	return editableField(label, wrapper);
}

export function textField(label: string, value: string, commit: (value: string) => void): HTMLElement {
	const input = document.createElement('input');
	input.className = 'property-input';
	input.type = 'text';
	input.value = value;
	registerCommit(input, () => {
		commit(input.value);
	});

	return editableField(label, input);
}

export function colorField(
	label: string,
	value: string,
	commit: (value: string) => void,
	palette: readonly CanvasColorSwatch[] = [],
): HTMLElement {
	const wrapper = document.createElement('span');
	wrapper.className = 'property-inline property-color-field';
	const colorInput = document.createElement('input');
	colorInput.className = 'property-color-input';
	colorInput.type = 'color';
	colorInput.value = colorInputValue(value);
	const textInput = document.createElement('input');
	textInput.className = 'property-input';
	textInput.type = 'text';
	textInput.value = value;
	registerCommit(textInput, () => {
		commit(textInput.value);
	});
	const paletteElement = colorPaletteElement(label, palette, textInput, colorInput);
	textInput.addEventListener('change', () => {
		syncColorInput(textInput.value, colorInput);
		updateSelectedColor(paletteElement, textInput.value);
	});
	colorInput.addEventListener('input', () => {
		textInput.value = colorInput.value.toUpperCase();
		updateSelectedColor(paletteElement, textInput.value);
	});
	colorInput.addEventListener('change', () => {
		commitColorValue(colorInput.value, textInput, colorInput);
	});
	colorInput.addEventListener('keydown', (event) => {
		event.stopPropagation();
	});
	wrapper.append(colorInput, textInput);
	if (palette.length > 0) {
		wrapper.appendChild(paletteElement);
	}

	return editableField(label, wrapper);
}

function colorPaletteElement(
	label: string,
	palette: readonly CanvasColorSwatch[],
	textInput: HTMLInputElement,
	colorInput: HTMLInputElement,
): HTMLElement {
	const paletteElement = document.createElement('span');
	paletteElement.className = 'property-color-palette';
	paletteElement.setAttribute('role', 'group');
	paletteElement.setAttribute('aria-label', `${label} palette`);
	for (const swatch of palette) {
		const button = document.createElement('button');
		button.className = 'property-color-swatch';
		button.type = 'button';
		button.style.backgroundColor = swatch.value;
		button.title = `${swatch.label} (${swatch.value})`;
		button.setAttribute('aria-label', `Set ${label.toLocaleLowerCase()} to ${swatch.label}, ${swatch.value}`);
		button.setAttribute('aria-pressed', String(colorsEqual(textInput.value, swatch.value)));
		button.dataset.color = swatch.value;
		button.addEventListener('click', () => {
			commitColorValue(swatch.value, textInput, colorInput);
			updateSelectedColor(paletteElement, swatch.value);
		});
		paletteElement.appendChild(button);
	}

	return paletteElement;
}

function commitColorValue(value: string, textInput: HTMLInputElement, colorInput: HTMLInputElement): void {
	textInput.value = value.toUpperCase();
	syncColorInput(textInput.value, colorInput);
	textInput.dispatchEvent(new Event('change'));
}

function syncColorInput(value: string, colorInput: HTMLInputElement): void {
	if (/^#[\da-f]{6}$/iu.test(value.trim())) {
		colorInput.value = value.trim();
	}
}

function updateSelectedColor(palette: HTMLElement, value: string): void {
	for (const swatch of palette.querySelectorAll<HTMLButtonElement>('.property-color-swatch')) {
		swatch.setAttribute('aria-pressed', String(colorsEqual(value, swatch.dataset.color ?? '')));
	}
}

function colorsEqual(left: string, right: string): boolean {
	return left.trim().toUpperCase() === right.trim().toUpperCase();
}

export function textAreaField(label: string, value: string, commit: (value: string) => void): HTMLElement {
	const input = document.createElement('textarea');
	input.className = 'property-textarea';
	input.value = value;
	registerCommit(input, () => {
		commit(input.value);
	});

	return editableField(label, input);
}

export function checkboxField(label: string, checked: boolean, commit: (checked: boolean) => void, indeterminate = false): HTMLElement {
	const input = document.createElement('input');
	input.className = 'property-checkbox';
	input.type = 'checkbox';
	input.checked = checked;
	input.indeterminate = indeterminate;
	if (indeterminate) {
		input.title = 'Selected nodes have different values';
	}
	input.addEventListener('change', () => {
		input.indeterminate = false;
		commit(input.checked);
	});
	input.addEventListener('keydown', (event) => {
		event.stopPropagation();
	});

	return editableField(label, input);
}

export function selectField<TValue extends string>(
	label: string,
	value: TValue | '',
	options: readonly { readonly value: TValue | ''; readonly label: string }[],
	commit: (value: TValue | undefined) => void,
): HTMLElement {
	const input = document.createElement('select');
	input.className = 'property-input';
	for (const option of options) {
		const optionElement = document.createElement('option');
		optionElement.value = option.value;
		optionElement.textContent = option.label;
		input.appendChild(optionElement);
	}
	input.value = value;
	registerCommit(input, () => {
		commit(input.value === '' ? undefined : input.value as TValue);
	});

	return editableField(label, input);
}

export function imageField(label: string, pick: () => void, clear?: () => void): HTMLElement {
	const wrapper = document.createElement('span');
	wrapper.className = 'property-inline property-image-actions';
	const button = document.createElement('button');
	button.className = 'property-button';
	button.type = 'button';
	button.textContent = 'Select';
	button.setAttribute('aria-label', `Select ${label.toLocaleLowerCase()}`);
	button.addEventListener('click', pick);
	wrapper.appendChild(button);
	if (clear !== undefined) {
		const clearButton = document.createElement('button');
		clearButton.className = 'property-button';
		clearButton.type = 'button';
		clearButton.textContent = 'Clear';
		clearButton.setAttribute('aria-label', `Clear ${label.toLocaleLowerCase()}`);
		clearButton.addEventListener('click', clear);
		wrapper.appendChild(clearButton);
	}

	return editableField(label, wrapper);
}

export function actionButton(label: string, kind: 'secondary' | 'danger', action: () => void): HTMLElement {
	const button = document.createElement('button');
	button.className = `property-button property-button-${kind}`;
	button.type = 'button';
	button.textContent = label;
	button.addEventListener('click', action);

	return button;
}

export function sectionElement(title: string, fields: readonly HTMLElement[]): HTMLElement {
	const section = document.createElement('section');
	section.className = 'property-section';
	const heading = document.createElement('h2');
	heading.className = 'property-section-title';
	heading.textContent = title;
	section.appendChild(heading);
	section.append(...fields);

	return section;
}

function editableField(label: string, input: HTMLElement): HTMLElement {
	const field = fieldElement(label);
	field.appendChild(input);

	return field;
}

function fieldElement(label: string): HTMLElement {
	const field = document.createElement('label');
	field.className = 'property-field';
	const labelElement = document.createElement('span');
	labelElement.className = 'property-label';
	labelElement.textContent = label;
	field.appendChild(labelElement);

	return field;
}

function registerCommit(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, commit: () => void): void {
	const initialValue = element.value;
	let lastCommittedValue = initialValue;
	element.addEventListener('change', () => {
		if (element.value !== lastCommittedValue) {
			lastCommittedValue = element.value;
			commit();
		}
	});
	element.addEventListener('keydown', (event) => {
		const keyboardEvent = event as KeyboardEvent;
		keyboardEvent.stopPropagation();
		if (keyboardEvent.key === 'Enter' && !(element instanceof HTMLTextAreaElement && keyboardEvent.shiftKey)) {
			keyboardEvent.preventDefault();
			element.blur();
		}
		if (keyboardEvent.key === 'Escape') {
			keyboardEvent.preventDefault();
			element.value = lastCommittedValue;
			element.blur();
		}
	});
}

function registerOptionalNumberCommit(input: HTMLInputElement, commit: (value: number | undefined) => void): void {
	registerCommit(input, () => {
		if (input.value.trim().length === 0) {
			commit(undefined);
			return;
		}

		const nextValue = Number(input.value);
		if (Number.isFinite(nextValue)) {
			commit(nextValue);
		}
	});
}

let generatedId = 0;

function nextGeneratedId(): number {
	generatedId += 1;

	return generatedId;
}

function colorInputValue(value: string): string {
	const trimmed = value.trim();
	if (/^#[0-9a-fA-F]{6}$/u.test(trimmed)) {
		return trimmed;
	}
	if (/^#[0-9a-fA-F]{8}$/u.test(trimmed)) {
		return trimmed.slice(0, 7);
	}

	return '#000000';
}
