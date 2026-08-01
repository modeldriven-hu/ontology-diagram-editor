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

suite('Ontology materialization use cases', () => {
	test('materializes object property edges with missing endpoint nodes', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:memberOf',
			displayLabel: 'memberOf',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person'],
				rangeReferences: ['ex:Organization'],
			},
		}, { x: 400, y: 120 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value), ['ex:Person', 'ex:Organization']);
		assert.ok(result.diagram.nodes.every((node) => node.bounds.width === 96 && node.bounds.height === 44));
		assert.ok(result.diagram.nodes.every((node) => node.labelTextOverflow === 'wrap'));
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_item1');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_item2');
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'ex:memberOf');
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 320, y: 142 },
			{ x: 480, y: 142 },
		]);
	});

	test('materializes an ambiguous object property edge with user-selected endpoints', () => {
		const payload = {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:contributesTo',
			displayLabel: 'contributes to',
			ontologyItemMetadata: {
				domainReferences: ['ex:Author', 'ex:Editor'],
				rangeReferences: ['ex:Book', 'ex:Website'],
			},
		};
		const rejected = new CreateEdgeUseCase().execute(emptyDiagram(), payload, { x: 400, y: 120 });
		assert.strictEqual(rejected.diagram, undefined);
		assert.strictEqual(rejected.notification, 'Select one source and one target ontology item to create this edge.');

		const result = new CreateEdgeUseCase().execute(emptyDiagram(), payload, { x: 400, y: 120 }, {
			sourceOntologyRef: 'ex:Editor',
			targetOntologyRef: 'ex:Website',
		});

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value), ['ex:Editor', 'ex:Website']);
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'ex:contributesTo');
	});

	test('materializes same-source-target property edges as self loops', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:knowsSelf',
			displayLabel: 'knowsSelf',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person'],
				rangeReferences: ['ex:Person'],
			},
		}, { x: 400, y: 120 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 1);
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_item1');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_item1');
		assert.deepStrictEqual(result.diagram.nodes[0].bounds.toPersistenceObject(), { x: 352, y: 120, width: 96, height: 44 });
		assert.strictEqual(result.diagram.nodes[0].labelTextOverflow, 'wrap');
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 448, y: 135 },
			{ x: 528, y: 135 },
			{ x: 528, y: 220 },
			{ x: 414, y: 164 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 536,
			y: 166,
		});
	});

	test('materializes subclass edges between existing nodes', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_person', 'ex:Person', new Bounds(10, 20, 180, 72)),
				new DiagramNode('node_agent', 'ex:Agent', new Bounds(360, 20, 180, 72)),
			],
			[],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person ⊑ Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_person');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_agent');
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'rdfs:subClassOf');
	});

	test('materializes object property assertion edges from individuals', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([
				['ex', 'https://example.com/requirements/instances#'],
				['req', 'https://example.com/requirements#'],
			]),
			[
				new DiagramNode(
					'node_requirement',
					'ex:REQ-001',
					new Bounds(40, 120, 360, 144),
					undefined,
					undefined,
					{ ontology_item_type: 'individual' },
					undefined,
					true,
					true,
				),
			],
			[],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'objectPropertyAssertion',
			ontologyItemReference: 'req:appliesTo',
			displayLabel: 'REQ-001 appliesTo AuthenticationService',
			ontologyItemMetadata: {
				edgeOntologyRef: 'req:appliesTo',
				sourceOntologyRef: 'ex:REQ-001',
				targetOntologyRef: 'ex:AuthenticationService',
				targetNodeType: 'individual',
			},
		}, { x: 460, y: 120 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges.length, 1);
		const targetNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:AuthenticationService');
		assert.ok(targetNode);
		assert.strictEqual(targetNode.extra.ontology_item_type, 'individual');
		assert.strictEqual(targetNode.showType, true);
		assert.strictEqual(targetNode.showPropertyValues, true);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_requirement');
		assert.strictEqual(result.diagram.edges[0].target.value, targetNode.id.value);
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'req:appliesTo');
		assert.strictEqual(result.diagram.edges[0].extra.ontology_item_type, 'objectPropertyAssertion');
	});

	test('routes bottom-side subclass edges through a shared generalization trunk', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_employee', 'ex:Employee', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_customer', 'ex:Customer', new Bounds(180, 140, 100, 50)),
				new DiagramNode('node_person', 'ex:Person', new Bounds(80, 0, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_employeePerson',
					'node_employee',
					'node_person',
					'rdfs:subClassOf',
					new Point(80, 80),
					[new Point(50, 100), new Point(80, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_customerPerson',
					'node_customer',
					'node_person',
					'rdfs:subClassOf',
					new Point(200, 90),
					[new Point(230, 140), new Point(200, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, ['node_employee', 'node_customer']);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		const updatedEdges = new Map(result.diagram.edges.map((edge) => [edge.id.value, edge] as const));
		const employeeEdge = updatedEdges.get('edge_employeePerson');
		const customerEdge = updatedEdges.get('edge_customerPerson');
		assert.ok(employeeEdge);
		assert.ok(customerEdge);
		assert.deepStrictEqual(employeeEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 50, y: 100 },
			{ x: 50, y: 80 },
			{ x: 140, y: 80 },
			{ x: 140, y: 60 },
		]);
		assert.deepStrictEqual(customerEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 230, y: 140 },
			{ x: 230, y: 80 },
			{ x: 140, y: 80 },
			{ x: 140, y: 60 },
		]);
	});

	test('routes left-side subclass edges through a shared generalization trunk', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_constraint', 'ex:Constraint', new Bounds(64, 178, 360, 144)),
				new DiagramNode('node_rule', 'ex:Rule', new Bounds(536, 746, 120, 80)),
				new DiagramNode('node_requirement', 'ex:Requirement', new Bounds(780, 160, 360, 144)),
			],
			[
				new DiagramEdge(
					'edge_constraintRequirement',
					'node_constraint',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(540, 220),
					[new Point(424, 322), new Point(780, 250)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_ruleRequirement',
					'node_rule',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(540, 620),
					[new Point(656, 786), new Point(780, 250)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, ['node_constraint', 'node_rule']);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		const updatedEdges = new Map(result.diagram.edges.map((edge) => [edge.id.value, edge] as const));
		const constraintEdge = updatedEdges.get('edge_constraintRequirement');
		assert.ok(constraintEdge);
		const constraintPoints = constraintEdge.points.map((point) => point.toPersistenceObject());
		assert.deepStrictEqual(constraintPoints, [
			{ x: 424, y: 250 },
			{ x: 718, y: 250 },
			{ x: 718, y: 232 },
			{ x: 780, y: 232 },
		]);
	});

	test('uses the selected subclass box to route every bottom-side source from its top edge', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_constraint', 'ex:Constraint', new Bounds(153, 511, 238, 95)),
				new DiagramNode('node_functionalRequirement', 'ex:FunctionalRequirement', new Bounds(483, 511, 237, 95)),
				new DiagramNode('node_qualityRequirement', 'ex:QualityRequirement', new Bounds(812, 511, 238, 95)),
				new DiagramNode('node_requirement', 'ex:Requirement', new Bounds(575, 103, 238, 95)),
			],
			[
				new DiagramEdge(
					'edge_constraintRequirement',
					'node_constraint',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(430, 340),
					[new Point(391, 558), new Point(694, 198)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_functionalRequirementRequirement',
					'node_functionalRequirement',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(520, 340),
					[new Point(720, 558), new Point(694, 198)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_qualityRequirementRequirement',
					'node_qualityRequirement',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(820, 340),
					[new Point(812, 558), new Point(694, 198)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, [
			'node_constraint',
			'node_functionalRequirement',
			'node_qualityRequirement',
		]);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		const updatedEdges = new Map(result.diagram.edges.map((edge) => [edge.id.value, edge] as const));
		const constraintEdge = updatedEdges.get('edge_constraintRequirement');
		const functionalRequirementEdge = updatedEdges.get('edge_functionalRequirementRequirement');
		const qualityRequirementEdge = updatedEdges.get('edge_qualityRequirementRequirement');
		assert.ok(constraintEdge);
		assert.ok(functionalRequirementEdge);
		assert.ok(qualityRequirementEdge);
		assert.deepStrictEqual(constraintEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 272, y: 511 },
			{ x: 272, y: 355 },
			{ x: 694, y: 355 },
			{ x: 694, y: 198 },
		]);
		assert.deepStrictEqual(functionalRequirementEdge.points[0].toPersistenceObject(), { x: 602, y: 511 });
		assert.deepStrictEqual(qualityRequirementEdge.points[0].toPersistenceObject(), { x: 931, y: 511 });
		assert.deepStrictEqual(functionalRequirementEdge.points[functionalRequirementEdge.points.length - 1].toPersistenceObject(), { x: 694, y: 198 });
	});

	test('routes right-side subclass edges through a shared generalization trunk', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_employee', 'ex:Employee', new Bounds(360, 80, 100, 50)),
				new DiagramNode('node_customer', 'ex:Customer', new Bounds(520, 140, 100, 50)),
				new DiagramNode('node_person', 'ex:Person', new Bounds(80, 100, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_employeePerson',
					'node_employee',
					'node_person',
					'rdfs:subClassOf',
					new Point(0, 0),
					[new Point(360, 105), new Point(200, 130)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
					'direct',
				),
				new DiagramEdge(
					'edge_customerPerson',
					'node_customer',
					'node_person',
					'rdfs:subClassOf',
					new Point(0, 0),
					[new Point(520, 165), new Point(200, 130)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, ['node_employee', 'node_customer']);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		const updatedEdges = new Map(result.diagram.edges.map((edge) => [edge.id.value, edge] as const));
		const employeeEdge = updatedEdges.get('edge_employeePerson');
		const customerEdge = updatedEdges.get('edge_customerPerson');
		assert.ok(employeeEdge);
		assert.ok(customerEdge);
		assert.deepStrictEqual(employeeEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 360, y: 105 },
			{ x: 280, y: 105 },
			{ x: 280, y: 130 },
			{ x: 200, y: 130 },
		]);
		assert.deepStrictEqual(customerEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 520, y: 165 },
			{ x: 280, y: 165 },
			{ x: 280, y: 130 },
			{ x: 200, y: 130 },
		]);
		assert.strictEqual(employeeEdge.routeLayout, 'orthogonal');
	});

	test('does not align subclass endpoints without one shared superclass', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_employee', 'ex:Employee', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_customer', 'ex:Customer', new Bounds(180, 140, 100, 50)),
				new DiagramNode('node_person', 'ex:Person', new Bounds(80, 0, 120, 60)),
				new DiagramNode('node_agent', 'ex:Agent', new Bounds(260, 0, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_employeePerson',
					'node_employee',
					'node_person',
					'rdfs:subClassOf',
					new Point(80, 80),
					[new Point(50, 100), new Point(80, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_customerAgent',
					'node_customer',
					'node_agent',
					'rdfs:subClassOf',
					new Point(260, 90),
					[new Point(230, 140), new Point(260, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, ['node_employee', 'node_customer']);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Selected nodes do not share the same superclass edge.');
	});

	test('adds the rdfs namespace when materializing subclass edges', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person ⊑ Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.namespaces.get('rdfs'), 'http://www.w3.org/2000/01/rdf-schema#');
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'rdfs:subClassOf');
	});

	test('matches subclass endpoints by equivalent compact and full ontology references', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_person', 'https://example.com/ontology#Person', new Bounds(10, 20, 180, 72)),
				new DiagramNode('node_agent', 'https://example.com/ontology#Agent', new Bounds(360, 20, 180, 72)),
			],
			[],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person ⊑ Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_person');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_agent');
	});

	test('reports duplicate materialized edges without changing the diagram', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_person', 'ex:Person', new Bounds(10, 20, 180, 72)),
				new DiagramNode('node_agent', 'ex:Agent', new Bounds(360, 20, 180, 72)),
			],
			[
				new DiagramEdge(
					'edge_item1',
					'node_person',
					'node_agent',
					'rdfs:subClassOf',
					new Point(275, 56),
					[new Point(190, 56), new Point(360, 56)],
				),
			],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person ⊑ Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, '"Person ⊑ Agent" already has an edge in this diagram.');
	});

	test('reports ambiguous edge endpoint metadata without changing the diagram', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:ambiguous',
			displayLabel: 'ambiguous',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person', 'ex:Organization'],
				rangeReferences: ['ex:Role'],
			},
		}, { x: 200, y: 20 });

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Select one source and one target ontology item to create this edge.');
	});

	test('shows directly related ontology elements for a selected node', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(300, 200, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_person', 1, [
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:memberOf',
				displayLabel: 'memberOf',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				},
			},
			{
				ontologyItemType: 'subclassRelationship',
				ontologyItemReference: 'rdfs:subClassOf',
				displayLabel: 'Employee ⊑ Person',
				ontologyItemMetadata: {
					subclassReference: 'ex:Employee',
					superclassReference: 'ex:Person',
				},
			},
		]);

		assert.ok(result.diagram);
		assert.strictEqual(result.notification, undefined);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value).sort(), ['ex:Employee', 'ex:Organization', 'ex:Person']);
		const employeeNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:Employee');
		const organizationNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:Organization');
		assert.ok(employeeNode);
		assert.ok(organizationNode);
		assert.ok([employeeNode, organizationNode].every((node) => node.bounds.width === 96 && node.bounds.height === 44));
		assert.ok([employeeNode, organizationNode].every((node) => node.labelTextOverflow === 'wrap'));
		const subclassEdge = result.diagram.edges.find((edge) => edge.ontologyRef.value === 'rdfs:subClassOf');
		const propertyEdge = result.diagram.edges.find((edge) => edge.ontologyRef.value === 'ex:memberOf');
		assert.ok(subclassEdge);
		assert.ok(propertyEdge);
		assert.strictEqual(subclassEdge.source.value, employeeNode.id.value);
		assert.strictEqual(subclassEdge.target.value, 'node_person');
		assert.strictEqual(propertyEdge.source.value, 'node_person');
		assert.strictEqual(propertyEdge.target.value, organizationNode.id.value);
		assert.strictEqual(result.diagram.namespaces.get('rdfs'), 'http://www.w3.org/2000/01/rdf-schema#');
	});

	test('shows only missing ontology edges between selected nodes', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 180, 72)),
			new DiagramNode('node_organization', 'ex:Organization', new Bounds(300, 0, 180, 72)),
			new DiagramNode('node_role', 'ex:Role', new Bounds(600, 0, 180, 72)),
		]);

		const useCase = new ShowRelatedElementsUseCase();
		const relationships = [{
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:memberOf',
			displayLabel: 'memberOf',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person', 'ex:Role'],
				rangeReferences: ['ex:Organization'],
			},
		}];

		const result = useCase.showEdgesBetweenNodes(
			diagram,
			['node_person', 'node_organization'],
			relationships,
		);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => ({
			ontologyRef: edge.ontologyRef.value,
			source: edge.source.value,
			target: edge.target.value,
		})), [{
			ontologyRef: 'ex:memberOf',
			source: 'node_person',
			target: 'node_organization',
		}]);

		const duplicate = useCase.showEdgesBetweenNodes(
			result.diagram,
			['node_person', 'node_organization'],
			relationships,
		);
		assert.strictEqual(duplicate.diagram, undefined);
		assert.strictEqual(duplicate.notification, 'Ontology relationships between the selected nodes are already shown.');
	});

	test('reports when selected nodes have no ontology relationship', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 180, 72)),
			new DiagramNode('node_organization', 'ex:Organization', new Bounds(300, 0, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().showEdgesBetweenNodes(diagram, [
			'node_person',
			'node_organization',
		], [{
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:hasRole',
			displayLabel: 'hasRole',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person'],
				rangeReferences: ['ex:Role'],
			},
		}]);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'No ontology relationships were found between the selected nodes.');
	});

	test('skips data properties when showing related ontology elements', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(300, 200, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_person', 1, [
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:memberOf',
				displayLabel: 'memberOf',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				},
			},
			{
				ontologyItemType: 'dataProperty',
				ontologyItemReference: 'ex:identifier',
				displayLabel: 'identifier',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['rdfs:Literal'],
				},
			},
		]);

		assert.ok(result.diagram);
		assert.strictEqual(result.notification, undefined);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value).sort(), ['ex:Organization', 'ex:Person']);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.ontologyRef.value), ['ex:memberOf']);
	});

	test('shows object property assertion targets for selected individuals', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([
				['ex', 'https://example.com/requirements/instances#'],
				['req', 'https://example.com/requirements#'],
			]),
			[
				new DiagramNode(
					'node_requirement',
					'ex:REQ-001',
					new Bounds(300, 200, 360, 144),
					undefined,
					undefined,
					{ ontology_item_type: 'individual' },
					undefined,
					true,
					true,
				),
			],
			[],
		);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_requirement', 1, [
			{
				ontologyItemType: 'objectPropertyAssertion',
				ontologyItemReference: 'req:appliesTo',
				displayLabel: 'REQ-001 appliesTo AuthenticationService',
				ontologyItemMetadata: {
					edgeOntologyRef: 'req:appliesTo',
					sourceOntologyRef: 'ex:REQ-001',
					targetOntologyRef: 'ex:AuthenticationService',
					targetNodeType: 'individual',
				},
			},
		]);

		assert.ok(result.diagram);
		assert.strictEqual(result.notification, undefined);
		const targetNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:AuthenticationService');
		assert.ok(targetNode);
		assert.strictEqual(targetNode.extra.ontology_item_type, 'individual');
		assert.strictEqual(targetNode.showType, true);
		assert.strictEqual(targetNode.showPropertyValues, true);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_requirement');
		assert.strictEqual(result.diagram.edges[0].target.value, targetNode.id.value);
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'req:appliesTo');
		assert.strictEqual(result.diagram.edges[0].extra.ontology_item_type, 'objectPropertyAssertion');
	});

	test('shows related ontology elements to the selected depth', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(100, 100, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_person', 2, [
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:memberOf',
				displayLabel: 'memberOf',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				},
			},
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:hasRole',
				displayLabel: 'hasRole',
				ontologyItemMetadata: {
					domainReferences: ['ex:Organization'],
					rangeReferences: ['ex:Role'],
				},
			},
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value), ['ex:Person', 'ex:Organization', 'ex:Role']);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.ontologyRef.value).sort(), ['ex:hasRole', 'ex:memberOf']);
		const roleNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:Role');
		assert.ok(roleNode);
		assert.strictEqual(roleNode.bounds.x > diagram.nodes[0].bounds.x, true);
	});

});

