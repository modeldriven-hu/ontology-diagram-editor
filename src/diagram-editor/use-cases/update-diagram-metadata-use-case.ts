import { DiagramMetadata, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { DiagramMetadataPatch } from '../../shared/webview-commands';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateDiagramMetadataUseCase {
	public execute(diagram: OntologyDiagramDocument, patch: DiagramMetadataPatch): DiagramMutationResult {
		const metadata = new DiagramMetadata(
			diagram.metadata.schemaVersion,
			patch.title ?? diagram.metadata.title,
			patch.authors ?? diagram.metadata.authors,
			patch.diagram_version ?? diagram.metadata.diagramVersion,
			Object.hasOwn(patch, 'theme_file') ? patch.theme_file : diagram.metadata.themeFile,
			diagram.metadata.additional,
			diagram.metadata.extra,
			diagram.metadata.themeMode,
		);

		if (JSON.stringify(metadata.toPersistenceObject()) === JSON.stringify(diagram.metadata.toPersistenceObject())) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, { metadata }),
		};
	}
}
