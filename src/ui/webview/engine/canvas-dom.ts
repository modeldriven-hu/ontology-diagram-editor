export function requiredElement(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`Missing required element #${id}.`);
	}

	return element;
}

export function messageElement(className: string, text: string): HTMLElement {
	const element = document.createElement('div');
	element.className = className;
	element.textContent = text;
	return element;
}

export function showTransientStatus(status: HTMLElement, message: string): void {
	status.textContent = message;
	status.classList.add('visible');
	setTimeout(() => {
		status.classList.remove('visible');
	}, 3500);
}

export function setActionTooltip(element: HTMLElement, tooltip: string): void {
	element.title = tooltip;
	element.setAttribute('aria-label', tooltip);
	element.dataset.tooltip = tooltip;
}

export function isKeyboardInputTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLButtonElement
		|| target instanceof HTMLTextAreaElement
		|| target instanceof HTMLInputElement
		|| target instanceof HTMLSelectElement
		|| (target instanceof HTMLElement && target.isContentEditable);
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLTextAreaElement
		|| target instanceof HTMLInputElement
		|| target instanceof HTMLSelectElement
		|| (target instanceof HTMLElement && target.isContentEditable);
}
