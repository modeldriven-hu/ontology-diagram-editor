import * as assert from 'assert';

import { NodeCommentTooltipController, nodeCommentTooltipPosition, nodeCommentTooltipText, nodeIdForPointerTarget } from '../ui/webview/components/node-comment-tooltip';
import type { DiagramNode, DiagramPayload } from '../ui/webview/ontology-diagram-types';

suite('Node comment tooltip', () => {
	test('resolves and joins all comments for a node', () => {
		const payload: DiagramPayload = {
			diagram: {
				namespaces: { ex: 'https://example.com/ontology#' },
			},
			ontology: {
				comments: [{
					reference: 'https://example.com/ontology#Requirement',
					comments: ['Primary comment.', 'Additional context.'],
				}],
			},
		};

		assert.strictEqual(
			nodeCommentTooltipText(node, payload),
			'Primary comment.\n\nAdditional context.',
		);
	});

	test('positions the tooltip beside the pointer', () => {
		assert.deepStrictEqual(nodeCommentTooltipPosition(
			{ clientX: 140, clientY: 90 },
			{ left: 100, top: 50, width: 500, height: 300 },
			{ width: 160, height: 80 },
		), { x: 52, y: 52 });
	});

	test('resolves a rendered X6 node from a pointer target', () => {
		assert.strictEqual(nodeIdForPointerTarget({
			closest: (selector: string) => selector === '.x6-node[data-cell-id]'
				? { getAttribute: () => 'node_requirement' }
				: undefined,
		}), 'node_requirement');
	});

	test('shows the comment from a capture-phase canvas pointer event', () => {
		const listeners = new Map<string, (event: PointerEvent) => void>();
		const tooltip = {
			hidden: true,
			style: {},
			textContent: '',
			getBoundingClientRect: () => ({ width: 160, height: 80 }),
		} as unknown as HTMLElement;
		const controller = new NodeCommentTooltipController({
			tooltip,
			container: {
				getBoundingClientRect: () => ({ left: 100, top: 50, width: 500, height: 300 }),
			} as unknown as HTMLElement,
			hoverSurface: {
				addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
					if (typeof listener === 'function') {
						listeners.set(type, listener as (event: PointerEvent) => void);
					}
				},
			} as unknown as HTMLElement,
			commentTextForNodeId: (nodeId) => nodeId === 'node_requirement' ? 'Node comment.' : '',
		});
		controller.register();

		listeners.get('pointerover')?.({
			buttons: 0,
			clientX: 140,
			clientY: 90,
			target: {
				closest: () => ({ getAttribute: () => 'node_requirement' }),
			},
		} as unknown as PointerEvent);

		assert.strictEqual(tooltip.hidden, false);
		assert.strictEqual(tooltip.textContent, 'Node comment.');
		assert.strictEqual(tooltip.style.left, '52px');
		assert.strictEqual(tooltip.style.top, '52px');
	});

	test('flips the tooltip away from the container edges', () => {
		assert.deepStrictEqual(nodeCommentTooltipPosition(
			{ clientX: 580, clientY: 330 },
			{ left: 100, top: 50, width: 500, height: 300 },
			{ width: 160, height: 80 },
		), { x: 308, y: 188 });
	});
});

const node: DiagramNode = {
	id: 'node_requirement',
	ontology_ref: 'ex:Requirement',
	x: 10,
	y: 20,
	width: 160,
	height: 80,
};
