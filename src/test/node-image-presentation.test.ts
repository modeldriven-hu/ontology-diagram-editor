import * as assert from 'assert';

import { createEmbeddedGalleryIcon } from '../shared/embedded-gallery-icon';
import { applyCanvasElementStyleUpdates } from '../ui/webview/components/canvas-element-style-updates';
import { CanvasElementRegistry } from '../ui/webview/components/canvas-element-registry';
import { nodeImagePresentation } from '../ui/webview/components/presentation/diagram-presentation';
import { x6OntologyNodeImageAttrs, x6OntologyNodeImageViewportAttrs, x6OntologyNodeMarkup } from '../ui/webview/engine/x6-node-cell-factories';
import type { DiagramPayload } from '../ui/webview/ontology-diagram-types';

suite('Node image presentation', () => {
	const node = {
		id: 'node_department',
		ontology_ref: 'ex:Department',
		x: 16,
		y: 12,
		width: 208,
		height: 156,
		image: createEmbeddedGalleryIcon('<path d="M0 0h32v16H0z"/>', 32, 16),
	};
	const payload: DiagramPayload = {
		diagram: {
			nodes: [node],
			edges: [],
		},
	};

	test('uses explicit geometry for every image fit option', () => {
		const viewport = { x: 0, y: 0, width: 192, height: 100 };
		assert.deepStrictEqual(nodeImagePresentation(node, viewport), {
			bounds: viewport,
			preserveAspectRatio: 'xMidYMid meet',
		});
		assert.deepStrictEqual(nodeImagePresentation({ ...node, style: { image_fit: 'cover' } }, viewport), {
			bounds: viewport,
			preserveAspectRatio: 'xMidYMid slice',
		});
		assert.deepStrictEqual(nodeImagePresentation({ ...node, style: { image_fit: 'match_width' } }, viewport), {
			bounds: { x: 0, y: 0, width: 192, height: 96 },
			preserveAspectRatio: 'xMidYMid meet',
		});
		assert.deepStrictEqual(nodeImagePresentation({ ...node, style: { image_fit: 'match_height' } }, viewport), {
			bounds: { x: -4, y: 0, width: 200, height: 100 },
			preserveAspectRatio: 'xMidYMid meet',
		});
	});

	test('applies matched dimensions inside a clipped X6 image viewport', () => {
		const matchWidthNode = { ...node, style: { image_fit: 'match_width' as const } };
		assert.deepStrictEqual(x6OntologyNodeImageViewportAttrs(matchWidthNode, false), {
			x: 0,
			y: 8,
			width: 208,
			height: 100,
			overflow: 'hidden',
			pointerEvents: 'none',
			opacity: 1,
		});
		assert.deepStrictEqual(x6OntologyNodeImageAttrs(matchWidthNode, false), {
			x: 0,
			y: 0,
			width: 208,
			height: 104,
			'xlink:href': node.image,
			preserveAspectRatio: 'xMidYMid meet',
			pointerEvents: 'none',
			opacity: 1,
		});
		assert.deepStrictEqual(x6OntologyNodeMarkup([])[1], {
			tagName: 'svg',
			selector: 'nodeImageViewport',
			children: [{ tagName: 'image', selector: 'nodeImage' }],
		});

		const matchHeightNode = { ...node, style: { image_fit: 'match_height' as const } };
		assert.deepStrictEqual(x6OntologyNodeImageViewportAttrs(matchHeightNode, false), {
			x: 8,
			y: 8,
			width: 192,
			height: 100,
			overflow: 'hidden',
			pointerEvents: 'none',
			opacity: 1,
		});
		assert.deepStrictEqual(x6OntologyNodeImageAttrs(matchHeightNode, false), {
			x: -4,
			y: 0,
			width: 200,
			height: 100,
			'xlink:href': node.image,
			preserveAspectRatio: 'xMidYMid meet',
			pointerEvents: 'none',
			opacity: 1,
		});
	});

	test('updates the registry before refreshing a node whose fit style changed', () => {
		const registry = new CanvasElementRegistry(payload);
		const refreshedNodeIds: string[] = [];

		applyCanvasElementStyleUpdates(
			[{ elementType: 'node', id: node.id, style: { image_fit: 'match_width' } }],
			registry,
			{
				refreshNodePresentation: (id) => {
					const refreshed = registry.element(id);
					assert.strictEqual(refreshed?.kind === 'node' ? refreshed.value.style?.image_fit : undefined, 'match_width');
					refreshedNodeIds.push(id);
				},
			},
		);

		assert.deepStrictEqual(refreshedNodeIds, [node.id]);
		const updated = registry.element(node.id);
		assert.strictEqual(updated?.kind, 'node');
		assert.strictEqual(updated?.kind === 'node' ? updated.value.style?.image_fit : undefined, 'match_width');
	});
});
