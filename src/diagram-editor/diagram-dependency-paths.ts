import * as path from 'path';

import type { OntologyDiagramDocument } from '../documents/odiagram';

export type DiagramDependencyKind = 'ontology' | 'theme';

export interface DiagramDependency {
	readonly absolutePath: string;
	readonly kind: DiagramDependencyKind;
}

export function diagramDependencyPaths(
	diagramFilePath: string,
	diagram: Pick<OntologyDiagramDocument, 'metadata' | 'ontologies'>,
): readonly DiagramDependency[] {
	const diagramDirectory = path.dirname(diagramFilePath);
	const dependencies: DiagramDependency[] = diagram.ontologies.map((ontology) => ({
		absolutePath: path.resolve(diagramDirectory, ontology.path),
		kind: 'ontology',
	}));
	const themeFile = diagram.metadata.themeFile?.trim();
	if (themeFile !== undefined && themeFile.length > 0) {
		dependencies.push({
			absolutePath: path.resolve(diagramDirectory, themeFile),
			kind: 'theme',
		});
	}

	const uniqueDependencies = new Map<string, DiagramDependency>();
	for (const dependency of dependencies) {
		uniqueDependencies.set(`${dependency.kind}:${path.normalize(dependency.absolutePath)}`, dependency);
	}

	return [...uniqueDependencies.values()];
}
