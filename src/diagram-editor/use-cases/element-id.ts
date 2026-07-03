export function nextElementId(existingIds: readonly string[], prefix: 'node' | 'edge' | 'note' | 'image' | 'label'): string {
	const existingIdSet = new Set(existingIds);
	let index = existingIds.length + 1;

	while (existingIdSet.has(`${prefix}_item${index}`)) {
		index += 1;
	}

	return `${prefix}_item${index}`;
}
