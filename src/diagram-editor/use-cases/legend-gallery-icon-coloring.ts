import { DiagramLegendElement, DiagramNode } from '../../documents/odiagram';
import { recolorEmbeddedGalleryIcon } from '../../shared/embedded-gallery-icon';

/** Recolors embedded gallery icons to match the category assigned by an ontology legend. */
export function recolorGalleryIconsForLegend(
	nodes: readonly DiagramNode[],
	legend: DiagramLegendElement,
	ontologySourcePaths: ReadonlyMap<string, string>,
): readonly DiagramNode[] {
	if (legend.colorBy === 'none') {
		return nodes;
	}

	return nodes.map((node) => {
		const color = legendColorForNode(node, legend, ontologySourcePaths);
		const image = color === undefined || node.image === undefined
			? undefined
			: recolorEmbeddedGalleryIcon(node.image, color);
		if (image === undefined || image === node.image) {
			return node;
		}

		return new DiagramNode(
			node.id.value,
			node.ontologyRef.value,
			node.bounds,
			node.style,
			image,
			node.extra,
			node.showDataProperties,
			node.showType,
			node.showPropertyValues,
			node.propertyValueTextOverflow,
		);
	});
}

function legendColorForNode(
	node: DiagramNode,
	legend: DiagramLegendElement,
	ontologySourcePaths: ReadonlyMap<string, string>,
): string | undefined {
	const key = legend.colorBy === 'elementType'
		? typeof node.extra.ontology_item_type === 'string' ? node.extra.ontology_item_type : undefined
		: ontologySourcePaths.get(node.ontologyRef.value);
	return key === undefined ? undefined : legend.colors.get(key);
}
