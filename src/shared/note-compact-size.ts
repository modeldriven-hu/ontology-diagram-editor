export interface CompactNoteSizeOptions {
	readonly text: string;
	readonly minimumWidth: number;
	readonly minimumHeight: number;
	readonly fontSize: number;
	readonly measureTextWidth: (text: string) => number;
}

export const noteContentHorizontalPadding = 24;
export const noteContentVerticalPadding = 24;
export const noteCompactMaximumWidth = 320;
export const noteLineHeightFactor = 1.25;
export const defaultCompactNoteFontSize = 13;

export function requiredCompactNoteSize(options: CompactNoteSizeOptions): { readonly width: number; readonly height: number } {
	const explicitLines = normalizeLineEndings(options.text).split('\n');
	const widestLine = Math.max(0, ...explicitLines.map(options.measureTextWidth));
	const width = Math.ceil(Math.max(
		options.minimumWidth,
		Math.min(noteCompactMaximumWidth, widestLine + noteContentHorizontalPadding),
	));
	const contentWidth = Math.max(1, width - noteContentHorizontalPadding);
	const visualLineCount = explicitLines
		.map((line) => wrappedNoteLineCount({
			line,
			contentWidth,
			measureTextWidth: options.measureTextWidth,
		}))
		.reduce((sum, lineCount) => sum + lineCount, 0);
	const lineHeight = Math.ceil(options.fontSize * noteLineHeightFactor);
	const height = Math.ceil(Math.max(
		options.minimumHeight,
		(visualLineCount * lineHeight) + noteContentVerticalPadding,
	));

	return { width, height };
}

export function estimatedCompactNoteTextWidth(text: string, fontSize = defaultCompactNoteFontSize): number {
	return text.length * Math.max(1, fontSize * 0.56);
}

function normalizeLineEndings(value: string): string {
	return value.replace(/\r\n?/gu, '\n');
}

function wrappedNoteLineCount(options: {
	readonly line: string;
	readonly contentWidth: number;
	readonly measureTextWidth: (text: string) => number;
}): number {
	const words = options.line.trim().split(/\s+/u).filter((word) => word.length > 0);
	if (words.length === 0) {
		return 1;
	}

	let lineCount = 1;
	let currentLine = '';
	for (const word of words) {
		const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
		if (options.measureTextWidth(candidate) <= options.contentWidth) {
			currentLine = candidate;
			continue;
		}

		if (currentLine.length > 0) {
			lineCount += 1;
			currentLine = '';
		}

		currentLine = word;
		while (currentLine.length > 1 && options.measureTextWidth(currentLine) > options.contentWidth) {
			const breakIndex = Math.min(
				currentLine.length - 1,
				maximumFittingNotePrefixLength({ ...options, text: currentLine }),
			);
			lineCount += 1;
			currentLine = currentLine.slice(breakIndex);
		}
	}

	return lineCount;
}

function maximumFittingNotePrefixLength(options: {
	readonly text: string;
	readonly contentWidth: number;
	readonly measureTextWidth: (text: string) => number;
}): number {
	let lower = 1;
	let upper = options.text.length;
	while (lower < upper) {
		const middle = Math.ceil((lower + upper) / 2);
		if (options.measureTextWidth(options.text.slice(0, middle)) <= options.contentWidth) {
			lower = middle;
		} else {
			upper = middle - 1;
		}
	}

	return Math.max(1, lower);
}
