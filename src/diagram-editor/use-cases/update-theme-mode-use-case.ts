import { DiagramMetadata, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { DiagramThemeMode } from '../../shared/webview-commands';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateThemeModeUseCase {
	public execute(diagram: OntologyDiagramDocument, themeMode: DiagramThemeMode): DiagramMutationResult {
		if (diagram.metadata.themeMode === themeMode) {
			return {};
		}

		const metadata = new DiagramMetadata(
			diagram.metadata.schemaVersion,
			diagram.metadata.title,
			diagram.metadata.authors,
			diagram.metadata.diagramVersion,
			diagram.metadata.themeFile,
			diagram.metadata.additional,
			diagram.metadata.extra,
			themeMode,
		);

		return {
			diagram: cloneDiagram(diagram, { metadata }),
		};
	}
}
