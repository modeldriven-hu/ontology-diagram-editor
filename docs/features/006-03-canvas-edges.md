# Canvas Edges

This specification defines canvas behavior for creating, previewing, routing, and
editing ontology-backed edges.

# Scope

This specification covers connection-capable ontology item drops, note connection
edges, edge previews, endpoint behavior, edge label movement, and ontology-to-UML
rendering mapping. It also covers local edge actions shown in the canvas.

# Create Edges From Dragged Ontology Connections

When a dragged ontology item represents a connection-capable ontology type, the canvas
shall create an ontology-backed edge by resolving the relationship source and target
from the ontology item metadata included in the `Model tree item dragged` and
`Model tree item dropped on canvas` payloads.

Ontology-backed edges shall have an `ontology_ref` that identifies a
connection-capable ontology item from an ontology referenced by the opened `.odiagram`
file. Note connection edges are annotation edges and may use an implementation-defined
non-ontology reference.

Connection-capable ontology types in version 1 are:

| Ontology item type | Canvas result |
|-----------------------|---------------|
| Object property | Edge between two nodes. |
| Data property | Edge from a node to a datatype node when a datatype node is used as the target. |
| Subclass relationship | Generalization edge from a subclass node to a superclass node. |

Annotation property edge creation is not included in version 1 because annotation
properties often do not provide a single source and target endpoint.

The dropped ontology relationship shall define or allow the source and target ontology
items for the edge through runtime ontology metadata. For example, an object property
can use its domain as the source and range as the target, and a data property can use
its domain as the source and datatype range as the target. A subclass relationship shall
use the subclass as the source and the superclass as the target. These endpoint values
are not persisted into the `.odiagram` edge; the edge persists only its `ontology_ref`,
`source`, `target`, route, label position, and optional style overrides.

When a subclass relationship is persisted as an edge, the edge shall store
`rdfs:subClassOf` as `ontology_ref`. The specific subclass and superclass relationship is
identified by the edge `source` and `target` node references. The `.odiagram`
`namespaces` section shall define the `rdfs` namespace when compact `rdfs:subClassOf` is
used.

When a subclass relationship is dragged from the model tree, the canvas shall use the
drag payload's subclass and superclass metadata to identify the specific relationship
being materialized. The `rdfs:subClassOf` ontology reference alone is not sufficient to
distinguish one subclass relationship from another.

In version 1, edge materialization shall require exactly one resolved
source ontology item and exactly one resolved target ontology item. If either
endpoint is missing or ambiguous, the drop shall be rejected, no `.odiagram` change shall
be written, and the canvas shall show a clear message that the relationship needs a
single source and target.

When a valid source and target ontology item are known, dropping a connection-capable
ontology item on the canvas shall materialize the relationship as follows:

| Existing canvas state | Result |
|-----------------------|--------|
| Both source and target nodes already exist | Create the edge between the existing nodes. |
| Source node exists and target node is missing | Create the missing target node, then create the edge. |
| Target node exists and source node is missing | Create the missing source node, then create the edge. |
| Neither source nor target node exists | Create both missing nodes, then create the edge. |

The source and target nodes are considered to exist when the opened `.odiagram` file
contains nodes whose `ontology_ref` values match the resolved source and target ontology
items. In version 1, each resolved endpoint shall match at most one
existing canvas node. If more than one node matches the resolved source or target
ontology item, the drop shall be rejected, no `.odiagram` change shall be written,
and the canvas shall show a clear message that the endpoint appears more than once on
the canvas.

If an edge with the same `ontology_ref`, `source`, and `target` already exists, the
canvas shall show a concise message instead of creating a duplicate. No `.odiagram`
change shall be written for that drop.

For subclass relationship edges, duplicate detection shall use `rdfs:subClassOf` as the
`ontology_ref` together with the resolved subclass `source` node and superclass `target`
node. Duplicate detection occurs after the source and target endpoint nodes have been
resolved or created.

Nodes created as part of edge materialization shall follow the node creation rules from
`006-02-canvas-nodes.md`.

In version 1, missing endpoint nodes shall be placed deterministically:

- If both source and target nodes are missing, place the source node to the left of the
  drop point and the target node to the right of the drop point.
- If the source node exists and the target node is missing, place the target node to the
  right of the source node.
- If the target node exists and the source node is missing, place the source node to the
  left of the target node.

The implementation shall use consistent horizontal and vertical spacing that leaves the
new edge visible and selectable. If the computed position would overlap existing canvas
content, the implementation may offset the created node while preserving the relative
source-to-target direction.

# Local Edge Actions

When an edge is selected, the canvas shall show a local toolbar near the selected edge
route. The toolbar shall provide:

- A remove-edge action that deletes the selected edge without deleting its source or
  target elements.
- An optimize-edge-path action that recalculates the persisted route from the current
  endpoint bounds and updates the edge label to a route midpoint.
- A straighten-edge action that rewrites the selected edge route as a horizontal or
  vertical two-point line and updates the edge label to the new route midpoint.

When a connection-capable ontology item is dragged onto the canvas, the canvas shall
display a temporary edge preview.

The edge preview shall:

- Use the dragged ontology item as the future edge `ontology_ref`.
- Show the resolved source and target when they are known.
- Indicate whether the source node, target node, or both nodes will be created as part
  of completing the drop.
- Follow the pointer while the user positions the relationship.
- Snap endpoints to the boundary of existing or previewed source and target nodes when
  the source and target are valid.
- Show an invalid preview state when the relationship is missing a source or target,
  has an ambiguous source or target, or would otherwise be rejected by the edge
  materialization rules.
- Render with the UML-style arrowhead determined by the ontology-to-UML mapping.
- Not be persisted until the edge and all required endpoint nodes can be written as a
  valid `.odiagram` change.

The user shall be able to create the edge by dropping a connection-capable ontology
item once a valid source and target ontology item are known.

When the edge is completed, the canvas shall add an item to the `.odiagram` `edges`
section and add any missing endpoint nodes to the `.odiagram` `nodes` section. The new
edge shall:

- Use a generated unique `id` using the `edge_` prefix.
- Store `source` as the source node identifier.
- Store `target` as the target node identifier.
- Store the dragged ontology item reference as `ontology_ref`.
- Store `points` with at least the source boundary point and target boundary point.
- Store `label` at a reasonable position near the route midpoint.
- Omit `style` unless the user customizes the edge.

If the user cancels the workflow, no `.odiagram` edge shall be written.

# Note Connection Edges

The canvas shall support persisted note connection edges between a note and a node,
note, or standalone image. Note connection edges shall render as dotted lines by
default and shall not use ontology relationship arrowheads.

The user shall create a note connection by selecting a note, choosing the local connect
note action, and then selecting a node, image, or another note. Creating a duplicate
connection between the same two elements shall be rejected without modifying the
`.odiagram` document.

When a connected node, note, or image is moved or resized, the canvas shall recalculate
the corresponding first or last point in the persisted `points` list so the edge remains
connected to the element boundary. Intermediate route points in an existing diagram
shall be preserved.

# Edit Edges

The edge route consists of:

- A source endpoint, stored as the first item in `points`.
- Zero or more intermediate break points, stored as intermediate items in `points`.
- A target endpoint, stored as the last item in `points`.

The source endpoint shall remain associated with the edge `source` element. The target
endpoint shall remain associated with the edge `target` element.

The canvas may expose route handles for moving edge anchors, route segments, or
intermediate break points. Completing a route edit shall update the persisted `points`
list and the persisted `label` point when it changes. Route edits shall not change the
edge `source` or `target` identifiers. The persisted first and last points shall remain
snapped to the current source and target element boundaries.

The user shall be able to select the edge route layout from the property panel. Version
1 route layout choices are default, orthogonal, direct, one side, Manhattan, metro, and
entity relation.

Changing the route layout shall update only the persisted `route_layout` field and
shall not rewrite the persisted route points. Rendering shall interpret the stored
points according to the selected route layout.

The optimize-edge-path action shall recalculate stale route points from the current
source and target element bounds. For default or orthogonal routes it shall create an
orthogonal route when the endpoints are not horizontally or vertically aligned. For
router-backed layouts, it shall keep the selected layout and reduce persisted points to
the current source and target anchors so the canvas router can compute display bends.

The user can move the edge label by dragging it, or by selecting the edge label/edge and
using the arrow keys. Arrow keys shall move the label by one canvas unit; holding
`Shift` shall move it by a larger implementation-defined step. Moving the label shall
update the persisted `label` point.

# Ontology to UML Rendering Mapping

The canvas shall use UML-style visual conventions for ontology-backed nodes and edges.
These conventions are rendered by the renderer based on the ontology concept represented
by each element. The canvas shall use the same mapping for edge previews while creating
ontology-backed connections.

Version 1 shall use the following mapping:

| Ontology concept | Canvas/UML concept | Rendering convention |
|------------------|--------------------|----------------------|
| Class | UML class-like node | Rectangle labeled with the class display name. |
| Individual | UML object-like node | Rectangle labeled with the individual display name. |
| Datatype | UML datatype-like node | Rectangle labeled with the datatype display name. |
| Object property | UML association | Solid line with open arrowhead toward the target node. |
| Data property | UML attribute association | Solid line with open arrowhead toward the datatype target node. |
| Subclass relationship | UML generalization | Solid line with hollow triangle arrowhead toward the superclass node. |
Arrowhead shape is rendering behavior and shall not require additional persisted fields
in version 1. Line style defaults shall be derived from the ontology-to-UML mapping. If
the user customizes an edge `line_style`, that customization shall override the default
line style from the ontology-to-UML mapping.
