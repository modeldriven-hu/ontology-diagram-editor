import * as vscode from 'vscode';
import type { EdgeEndpointSelection } from './use-cases/ontology-edge-endpoints';

export async function pickRelatedElementDepth(): Promise<number | undefined> {
	const selected = await vscode.window.showQuickPick([
		{ label: 'Depth 1', description: 'Directly connected elements', depth: 1 },
		{ label: 'Depth 2', description: 'Two relationship steps', depth: 2 },
		{ label: 'Depth 3', description: 'Three relationship steps', depth: 3 },
		{ label: 'Depth 4', description: 'Four relationship steps', depth: 4 },
		{ label: 'Depth 5', description: 'Five relationship steps', depth: 5 },
	], {
		title: 'Show Related Elements',
		placeHolder: 'Select how deep to add related ontology elements.',
	});

	return selected?.depth;
}

export async function pickEdgeEndpointSelection(
	edgeLabel: string,
	sourceOntologyRefs: readonly string[],
	targetOntologyRefs: readonly string[],
): Promise<EdgeEndpointSelection | undefined> {
	const sourceOntologyRef = await pickEdgeEndpoint('source', edgeLabel, sourceOntologyRefs);
	if (sourceOntologyRef === undefined) {
		return undefined;
	}

	const targetOntologyRef = await pickEdgeEndpoint('target', edgeLabel, targetOntologyRefs);
	if (targetOntologyRef === undefined) {
		return undefined;
	}

	return { sourceOntologyRef, targetOntologyRef };
}

async function pickEdgeEndpoint(
	endpoint: 'source' | 'target',
	edgeLabel: string,
	candidates: readonly string[],
): Promise<string | undefined> {
	if (candidates.length === 1) {
		return candidates[0];
	}

	if (candidates.length === 0) {
		return undefined;
	}

	const selected = await vscode.window.showQuickPick(
		candidates.map((reference) => ({
			label: endpointDisplayLabel(reference),
			description: endpointDisplayLabel(reference) === reference ? undefined : reference,
			reference,
		})),
		{
			title: `Select ${endpoint} for ${edgeLabel}`,
			placeHolder: `Choose the ontology ${endpoint} for this relationship.`,
		},
	);
	return selected?.reference;
}

function endpointDisplayLabel(reference: string): string {
	const separatorIndex = Math.max(reference.lastIndexOf('#'), reference.lastIndexOf('/'));
	return separatorIndex >= 0 && separatorIndex < reference.length - 1
		? reference.slice(separatorIndex + 1)
		: reference;
}


