import { Bounds, type DiagramNode, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { DiagramLayoutAlgorithm, DiagramLayoutResult } from './diagram-layout-algorithm';
import { roundLayoutCoordinate } from './layout-coordinate';

const canvasMargin = 80;
const horizontalGap = 180;
const verticalGap = 72;

export class DirectedLayerLayoutAlgorithm implements DiagramLayoutAlgorithm {
	public readonly id = 'directed-layers';

	public async layout(diagram: OntologyDiagramDocument): Promise<DiagramLayoutResult> {
		const layerByNodeId = nodeLayers(diagram);
		const nodesByLayer = new Map<number, DiagramNode[]>();
		for (const node of diagram.nodes) {
			const layer = layerByNodeId.get(node.id.value) ?? 0;
			const nodes = nodesByLayer.get(layer) ?? [];
			nodes.push(node);
			nodesByLayer.set(layer, nodes);
		}

		const nodeBoundsById = new Map<string, Bounds>();
		let x = canvasMargin;
		for (const layer of [...nodesByLayer.keys()].sort((left, right) => left - right)) {
			const nodes = nodesByLayer.get(layer) ?? [];
			const layerWidth = Math.max(...nodes.map((node) => node.bounds.width));
			let y = canvasMargin;
			for (const node of nodes) {
				nodeBoundsById.set(node.id.value, new Bounds(
					roundLayoutCoordinate(x),
					roundLayoutCoordinate(y),
					node.bounds.width,
					node.bounds.height,
				));
				y += node.bounds.height + verticalGap;
			}

			x += layerWidth + horizontalGap;
		}

		return { nodeBoundsById };
	}
}

function nodeLayers(diagram: OntologyDiagramDocument): ReadonlyMap<string, number> {
	const nodeIds = new Set(diagram.nodes.map((node) => node.id.value));
	const nodeOrder = new Map(diagram.nodes.map((node, index) => [node.id.value, index]));
	const outgoing = new Map<string, Set<string>>();
	const incomingCount = new Map(diagram.nodes.map((node) => [node.id.value, 0]));

	for (const edge of diagram.edges) {
		if (!nodeIds.has(edge.source.value) || !nodeIds.has(edge.target.value) || edge.source.value === edge.target.value) {
			continue;
		}

		const targets = outgoing.get(edge.source.value) ?? new Set<string>();
		if (targets.has(edge.target.value)) {
			continue;
		}

		targets.add(edge.target.value);
		outgoing.set(edge.source.value, targets);
		incomingCount.set(edge.target.value, (incomingCount.get(edge.target.value) ?? 0) + 1);
	}

	const layerByNodeId = new Map<string, number>();
	const queue = diagram.nodes
		.filter((node) => incomingCount.get(node.id.value) === 0)
		.map((node) => node.id.value);
	for (const nodeId of queue) {
		layerByNodeId.set(nodeId, 0);
	}

	for (let index = 0; index < queue.length; index += 1) {
		const sourceId = queue[index];
		const sourceLayer = layerByNodeId.get(sourceId) ?? 0;
		const targets = [...(outgoing.get(sourceId) ?? [])].sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));
		for (const targetId of targets) {
			layerByNodeId.set(targetId, Math.max(layerByNodeId.get(targetId) ?? 0, sourceLayer + 1));
			const nextIncomingCount = (incomingCount.get(targetId) ?? 0) - 1;
			incomingCount.set(targetId, nextIncomingCount);
			if (nextIncomingCount === 0) {
				queue.push(targetId);
			}
		}
	}

	const fallbackLayer = layerByNodeId.size === 0 ? 0 : Math.max(...layerByNodeId.values()) + 1;
	for (const node of diagram.nodes) {
		if (!layerByNodeId.has(node.id.value)) {
			layerByNodeId.set(node.id.value, fallbackLayer);
		}
	}

	return layerByNodeId;
}
