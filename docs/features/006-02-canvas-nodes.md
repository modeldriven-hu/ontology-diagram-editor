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
show a concise message instead of creating a duplicate. No `.odiagram` change shall be
written for that drop.

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
user edits them directly. When multiple selected nodes are moved together with keyboard
or mouse-drag movement, edges whose source and target nodes both move by the same offset
shall preserve their route shape and label position by translating the entire edge by
that offset instead of rerouting.

# Resize Nodes

The user can resize a node by dragging resize handles.

Resizing a node shall update its persisted `width` and `height` fields. If the resize
handle changes the top or left edge, the persisted `x` or `y` field shall also be
updated.

The canvas shall enforce a positive width and height and minimum dimensions that keep
node text and handles usable.

When a node is resized, connected edge endpoints shall be recalculated so they remain on
the node boundary.

# Show Data Properties

For class nodes, the property panel shall show the number of available data properties
whose domain matches the node's ontology reference. Matching shall compare ontology
references using the diagram namespace map so compact and expanded references can match.

The user shall be able to toggle whether those data properties are shown inside the
node. Enabling the toggle shall persist `show_data_properties: true` on the node.
Disabling the toggle shall remove the persisted field or otherwise make the effective
value `false`.

When data properties are shown, the node shall render a header area for the ontology
display name and an attribute area containing sorted data-property labels. Attribute
text should include the range display name when a range is available, for example
`age: integer`.

When the toggle is enabled from the property panel, the canvas may grow the node to fit
the available data properties while preserving the node position. If all data-property
rows still cannot fit in the node bounds, the renderer shall show a deterministic
overflow indicator rather than changing persisted geometry during rendering.

# Individual Property Values

For individual nodes, the property panel shall allow property assertion values to be
shown in the node attribute area. The user shall be able to choose whether long
property-value attribute text is truncated at the node width with `...` or wrapped onto
additional lines. If wrapped rows still exceed the node bounds, the renderer shall show
a deterministic overflow indicator.

Property-value attributes shall omit resource-valued assertions whose target is already
represented by another node in the diagram. This keeps object links on the canvas while
still allowing primitive values and enum-like resource values to be shown in the node.
