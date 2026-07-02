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

export function textAreaField(label: string, value: string, commit: (value: string) => void): HTMLElement {
	const input = document.createElement('textarea');
	input.className = 'property-textarea';
	input.value = value;
	registerCommit(input, () => {
		commit(input.value);
	});

	return editableField(label, input);
}

export function imageField(label: string, value: string, commit: (value: string) => void, pick: () => void): HTMLElement {
	const wrapper = document.createElement('span');
	wrapper.className = 'property-inline';
	const input = document.createElement('input');
	input.className = 'property-input';
	input.type = 'text';
	input.value = value;
	registerCommit(input, () => {
		commit(input.value);
	});
	const button = document.createElement('button');
	button.className = 'property-button';
	button.type = 'button';
	button.textContent = 'Pick';
	button.addEventListener('click', pick);
	wrapper.append(input, button);

	return editableField(label, wrapper);
}

export function actionButton(label: string, kind: 'danger', action: () => void): HTMLElement {
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

function registerCommit(element: HTMLInputElement | HTMLTextAreaElement, commit: () => void): void {
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
