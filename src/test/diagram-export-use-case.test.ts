import * as assert from 'assert';
import * as path from 'path';

import {
	Bounds,
	CommonStyle,
	DiagramEdge,
	DiagramImage,
	DiagramLabel,
	DiagramMetadata,
	DiagramNode,
	DiagramNote,
	FontStyle,
	LabelStyle,
	OntologyDiagramDocument,
	Point,
	parseOntologyDiagramYaml,
	readOntologyDiagramFile,
	stringifyOntologyDiagramYaml,
} from '../documents/odiagram';
import { AlignEdgeEndPointsUseCase, AlignEdgeStartPointsUseCase, AlignSubclassEndpointsUseCase, ArrangeDiagramUseCase, CreateCommentNoteUseCase, CreateEdgeUseCase, CreateImageUseCase, CreateLabelUseCase, CreateMetadataElementUseCase, CreateNodeUseCase, CreateNoteConnectionUseCase, DeleteEdgeUseCase, DeleteElementsUseCase, DeleteImageUseCase, DeleteLabelUseCase, DeleteMetadataElementUseCase, DeleteNodeUseCase, DeleteNoteUseCase, OptimizeEdgeRouteUseCase, SaveDiagramExportUseCase, ShowRelatedElementsUseCase, StraightenEdgeRouteUseCase, UpdateDiagramMetadataUseCase, UpdateEdgePresentationUseCase, UpdateEdgeRouteUseCase, UpdateEdgeRouteLayoutUseCase, UpdateElementBoundsUseCase, UpdateElementStyleUseCase, UpdateImageBoundsUseCase, UpdateImageSourceUseCase, UpdateLabelBoundsUseCase, UpdateLabelTextUseCase, UpdateMetadataBoundsUseCase, UpdateNodeBoundsUseCase, UpdateNodeDataPropertiesVisibilityUseCase, UpdateNodeImageUseCase, UpdateNodeLabelTextOverflowUseCase, UpdateNodePropertyValueTextOverflowUseCase, UpdateNodePropertyValuesVisibilityUseCase, UpdateNodeTypeDisplayUseCase, UpdateNodeTypeVisibilityUseCase, UpdateNoteBoundsUseCase, UpdateNoteExportVisibilityUseCase, UpdateThemeModeUseCase } from '../diagram-editor/use-cases';
import type { DiagramExportSavePort } from '../diagram-editor/use-cases';
import type { DiagramLayoutAlgorithm } from '../diagram-editor/layout';
import { isConnectionCapableOntologyItem } from '../diagram-editor/use-cases/ontology-edge-endpoints';
import { loadReferencedOntologies } from '../ui/model-tree/ontology-model';
import { RecordingDiagramExportSavePort, containmentTestDiagram, diagramWithImages, diagramWithLabels, diagramWithNodes, diagramWithNotes, emptyDiagram, overlaps } from './support/diagram-builders';

suite('Diagram export use case', () => {
	test('saves UTF-8 diagram exports through the export save port', async () => {
		const savePort = new RecordingDiagramExportSavePort('/workspace/example.svg');

		const result = await new SaveDiagramExportUseCase(savePort).execute({
			format: 'svg',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.svg',
			content: '<svg></svg>',
			encoding: 'utf8',
		});

		assert.deepStrictEqual(savePort.targetRequests, [{
			format: 'svg',
			extension: 'svg',
			formatLabel: 'SVG image',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.svg',
			saveLabel: 'Save SVG',
			title: 'Save diagram as SVG',
		}]);
		assert.strictEqual(savePort.writes.length, 1);
		assert.strictEqual(savePort.writes[0].targetPath, '/workspace/example.svg');
		assert.strictEqual(Buffer.from(savePort.writes[0].content).toString('utf8'), '<svg></svg>');
		assert.strictEqual(result.notification, 'Saved diagram export to /workspace/example.svg.');
	});

	test('does not write diagram exports when the save target is cancelled', async () => {
		const savePort = new RecordingDiagramExportSavePort(undefined);

		const result = await new SaveDiagramExportUseCase(savePort).execute({
			format: 'svg',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.svg',
			content: '<svg></svg>',
			encoding: 'utf8',
		});

		assert.strictEqual(savePort.writes.length, 0);
		assert.strictEqual(result.notification, undefined);
	});

	test('decodes base64 diagram exports before writing', async () => {
		const savePort = new RecordingDiagramExportSavePort('/workspace/example.png');

		await new SaveDiagramExportUseCase(savePort).execute({
			format: 'png',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.png',
			content: 'AAECAw==',
			encoding: 'base64',
		});

		assert.deepStrictEqual([...savePort.writes[0].content], [0, 1, 2, 3]);
		assert.deepStrictEqual(savePort.targetRequests[0], {
			format: 'png',
			extension: 'png',
			formatLabel: 'PNG image',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.png',
			saveLabel: 'Save PNG',
			title: 'Save diagram as PNG',
		});
	});
});

