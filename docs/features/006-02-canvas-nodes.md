# Canvas Nodes

This specification defines canvas behavior for ontology-backed nodes.

# Scope

This specification covers creating nodes from model tree item drag and drop events,
moving nodes, resizing nodes, and updating connected edge endpoints when node geometry
changes.

# Drag Ontology Items From the Model Tree

The canvas shall accept `Model tree item dragged` payloads for ontology item nodes and
`Model tree item dropped on canvas` events when those items are dropped on the canvas.

When a dragged ontology item represents a node-capable ontology type, dropping it on
the canvas shall create a new `.odiagram` node at the drop position.

Node-capable ontology types in version 1 are:

| Ontology item type | Canvas result |
|-----------------------|---------------|
| Class | Node. |
| Individual | Node. |
| Datatype | Node. |

In version 1, each ontology item shall have at most one
ontology-backed node on the canvas. If the user drops a node-capable ontology item
that already has a corresponding node in the opened `.odiagram` file, the canvas shall
select and reveal the existing node instead of creating a duplicate. No `.odiagram`
change shall be written for that drop.

The new node shall:

- Use the dragged ontology item reference as `ontology_ref`.
- Receive a generated unique `id` using the `node_` prefix.
- Use default width and height selected by the implementation.
- Use the drop position as its persisted `x` and `y`.
- Omit `style` unless the user customizes the node.

When a dragged ontology item represents a connection-capable ontology type, the canvas
shall use the edge creation workflow defined in `006-03-canvas-edges.md`.

Nodes are also created as part of edge materialization. When the user drops a
connection-capable ontology item and the resolved source or target ontology item
does not already have a corresponding node on the canvas, the canvas shall create the
missing node before creating the edge.

Nodes created as part of edge materialization shall:

- Use the resolved source or target ontology item reference as `ontology_ref`.
- Receive a generated unique `id` using the `node_` prefix.
- Use default width and height selected by the implementation.
- Use the deterministic edge materialization placement rules defined in
  `006-03-canvas-edges.md`.
- Omit `style` unless the user customizes the node.

# Move Nodes

The user can move a node by dragging the selected node.

Moving a node shall update its persisted `x` and `y` fields. The canvas shall keep the
node dimensions unchanged.

When a node is moved, edges connected to that node shall remain connected. The canvas
shall update the first or last route point of each connected edge so it remains on the
boundary of the moved node. Intermediate route points shall remain unchanged unless the
user edits them directly.

# Resize Nodes

The user can resize a node by dragging resize handles.

Resizing a node shall update its persisted `width` and `height` fields. If the resize
handle changes the top or left edge, the persisted `x` or `y` field shall also be
updated.

The canvas shall enforce a positive width and height and minimum dimensions that keep
node text and handles usable.

When a node is resized, connected edge endpoints shall be recalculated so they remain on
the node boundary.
