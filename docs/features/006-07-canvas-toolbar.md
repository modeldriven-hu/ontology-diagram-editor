# Canvas Toolbar

This specification defines the canvas-level toolbar used for global diagram actions.
Element inspection, geometry editing, image source editing, and element-level style
customization are handled by the property panel. Selected elements may also show a
small local toolbar for element-specific actions.

# Scope

This specification covers toolbar visibility, supported canvas actions, and viewport
controls. It does not define selected-element property editing or theme file editing.

# Canvas Actions

The canvas shall show a toolbar over the canvas viewport. The toolbar shall remain
visible while the user pans, scrolls, or zooms the diagram. The user shall be able to
move it within the canvas viewport using its drag handle; its position shall be restored
for the current webview.

Version 1 toolbar actions are:

| Action | Result |
|--------|--------|
| Search and add ontology item | Opens a searchable ontology-item picker and adds the selection at the current viewport. |
| Add note | Opens the note text entry flow and creates a note. |
| Add label | Opens the label text entry flow and creates a standalone label. |
| Add image | Opens the image picker and creates a standalone image. |
| Export SVG | Saves the diagram as an SVG export, as defined in `006-11-canvas-export.md`. |
| Export PNG | Saves the diagram as a PNG export, as defined in `006-11-canvas-export.md`. |
| Layout algorithm | Selects the algorithm used by Arrange Diagram without changing diagram content. |
| ELK layered gaps | Sets the node gap and the gap between layers used by ELK Layered. |
| Arrange diagram | Automatically positions ontology-backed nodes with the selected algorithm and reroutes connected edges. |
| Zoom out | Decreases canvas zoom without changing persisted coordinates. |
| Zoom in | Increases canvas zoom without changing persisted coordinates. |
| Fit diagram to view | Fits all rendered content in the visible viewport. |
| Reset viewport | Resets zoom and pan to the implementation-defined default. |
| Select corresponding model-tree item | Reveals the selected ontology-backed node or edge in the model tree when a matching item exists. |
| Toggle light/dark mode | Switches the canvas rendering palette between light and dark mode without changing persisted diagram geometry. |

Toolbar buttons shall be disabled or shall show a concise user-visible problem when the
action cannot be completed. For example, exporting an empty diagram shall not create an
empty export file.

Toolbar action groups shall be visually separated where this improves scanning. In
version 1, creation, export, layout, viewport, model-tree reveal, and
theme-mode actions are separate toolbar groups.

# Search And Add Ontology Item

The canvas toolbar shall provide a keyboard-accessible action for adding ontology items
without drag and drop. Invoking the action shall open a Visual Studio Code Quick Pick
containing supported classes, individuals, datatypes, object properties, data
properties, subclass relationships, and object-property assertions from every ontology
referenced by the diagram. Annotation properties are not addable in version 1.

The picker shall be searchable by display label, compact or full ontology reference,
item type, and source ontology file. Equal display labels shall remain distinguishable
by reference and source file. Nodes and concrete relationships already materialized on
the diagram shall be omitted from the picker so this workflow does not produce duplicate
notifications. Selecting a node-capable item shall create its node at the current
viewport's center insertion point. Selecting a relationship shall use the normal edge
materialization rules, including creation of unambiguous missing endpoint nodes.
Canceling the picker shall leave the diagram unchanged. Ambiguous selections shall use
the same validation messages as model-tree drag and drop.

# Arrange Diagram

The arrange diagram action shall update only diagram geometry. It shall preserve ontology
references, element identifiers, text, style overrides, images, notes, standalone labels,
and theme settings.

Arranging the diagram shall:

- Allow the user to select from the available layout algorithms.
- Arrange only selected ontology nodes when the selection contains at least one node;
  otherwise arrange every ontology node on the canvas.
- Provide a deterministic left-to-right directed-layers layout derived from
  ontology-backed edges, an ELK layered layout with orthogonal edge routing, an ELK
  force-directed layout, an ELK Mr. Tree layout, and a deterministic grid layout.
- Preserve each node's persisted width and height.
- Reroute connected edges so endpoints remain on element boundaries.
- Update edge label positions to reasonable route midpoints.
- Persist the result as one logical `.odiagram` document edit.

The selected layout algorithm is viewport state rather than diagram content. Changing the
selection alone shall not modify the `.odiagram` document.

When ELK Layered is selected, the toolbar shall show editable node-gap and layer-gap
controls in a second toolbar row. Their values are viewport state, and shall not modify
the `.odiagram` document until Arrange Diagram is invoked.

If the diagram has no ontology-backed nodes, the toolbar action shall be disabled or show
a concise user-visible problem without changing the `.odiagram` document.

# Theme Mode

The theme-mode action shall toggle between light and dark render modes. The canvas shall
rerender using the selected mode while preserving the selected element where practical.

Changing the mode shall persist the selected value to `metadata.theme_mode` in the
opened `.odiagram` file. The action shall not edit the referenced `.otheme` file.

# Style Editing

Version 1 does not use the canvas toolbar or local element toolbar for element-level
style customization. Element style overrides are edited in the selected element's
property panel.

# Local Element Toolbar

When a selected element has local actions, the canvas may show a small toolbar above
that element.

Version 1 local toolbar actions are:

| Selection | Actions |
|-----------|---------|
| Node | Resize to minimum; create note from ontology comment when a comment is available; show related elements to a selected relationship depth. |
| Note | Resize to compact size and connect note. |
| Image | Resize to minimum. |
| Label | Resize to minimum. |
| Edge | Optimize edge path, choose a routing type, straighten the route, and remove edge. |

The show-related-elements node action shall ask the user for a relationship depth. It
shall add unambiguous object-property relationships, object-property assertions, and
subclass relationships reachable from the selected node up to that depth. Existing
nodes and edges shall not be duplicated. Data properties shall not create datatype
nodes or edges through this action; they remain available in a node's data-property
attribute section. The expansion shall be persisted as one logical `.odiagram` document
edit. A successful expansion does not require a notification because the added elements
are immediately visible on the canvas. Rejected and no-op expansions shall still show a
concise explanation.

The local toolbar shall be hidden while on-canvas note or label text editing is active.

When one edge is selected, its local toolbar shall show a routing-type combobox. The
combobox shall display the edge's current routing type and shall update `route_layout`
when the user selects a different type. An edge without an explicit routing type shall
display `Default (orthogonal)`.
