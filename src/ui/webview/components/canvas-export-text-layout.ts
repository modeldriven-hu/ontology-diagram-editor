export function wrapLines(text: string, width: number, fontSize: number): readonly string[] {
	const maxCharacters = Math.max(1, Math.floor(width / Math.max(1, fontSize * 0.56)));
	const wrappedLines: string[] = [];
	for (const rawLine of text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')) {
		const words = rawLine.split(/\s+/u).filter((word) => word.length > 0);
		if (words.length === 0) {
			wrappedLines.push('');
			continue;
		}

		let currentLine = '';
		for (const word of words) {
			if (word.length > maxCharacters) {
				if (currentLine.length > 0) {
					wrappedLines.push(currentLine);
					currentLine = '';
				}
				for (let index = 0; index < word.length; index += maxCharacters) {
					wrappedLines.push(word.slice(index, index + maxCharacters));
				}
				continue;
			}

			const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
			if (candidate.length > maxCharacters) {
				wrappedLines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = candidate;
			}
		}
		if (currentLine.length > 0) {
			wrappedLines.push(currentLine);
		}
	}

	return wrappedLines.length === 0 ? [''] : wrappedLines;
}

export function explicitLines(text: string): readonly string[] {
	const lines = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');

	return lines.length === 0 ? [''] : lines;
}


