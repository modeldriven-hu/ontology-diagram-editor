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

export function colorField(label: string, value: string, commit: (value: string) => void): HTMLElement {
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
	colorInput.addEventListener('input', () => {
		textInput.value = colorInput.value.toUpperCase();
	});
	colorInput.addEventListener('change', () => {
		textInput.value = colorInput.value.toUpperCase();
		commit(textInput.value);
	});
	colorInput.addEventListener('keydown', (event) => {
		event.stopPropagation();
	});
	wrapper.append(colorInput, textInput);

	return editableField(label, wrapper);
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

export function checkboxField(label: string, checked: boolean, commit: (checked: boolean) => void): HTMLElement {
	const input = document.createElement('input');
	input.className = 'property-checkbox';
	input.type = 'checkbox';
	input.checked = checked;
	input.addEventListener('change', () => {
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
