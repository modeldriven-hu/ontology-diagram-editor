# Acceptance Tests: Canvas Toolbar

## Canvas Toolbar

- Given the canvas view is open, when the user pans, scrolls, or zooms, then the canvas toolbar remains visible over the viewport.
- Given the user drags the canvas toolbar by its drag handle, when the drag completes, then the toolbar moves within the canvas viewport and its position is restored for that webview.
- Given supported ontology items are loaded, when the user chooses Search and Add Ontology Item, then a Quick Pick searchable by label, reference, type, and ontology file is shown.
- Given the user selects a class, individual, or datatype in the ontology picker, when persistence completes, then its node is added at the current viewport center insertion point.
- Given the user selects an object property, data property, subclass relationship, or object-property assertion in the ontology picker, when its endpoints are unambiguous, then the relationship and any missing endpoint nodes are materialized using the normal edge creation rules.
- Given equal ontology-item labels occur in different ontology files, when the picker is shown, then their references and source files distinguish the entries.
- Given a node or concrete relationship is already materialized on the diagram, when the ontology picker opens, then that item is omitted and no duplicate notification can be triggered from the picker.
- Given every supported ontology item is already materialized, when the ontology picker opens, then it shows no available matches without displaying a separate notification.
- Given the ontology picker is canceled, when it closes, then the `.odiagram` document is unchanged.
- Given the user chooses Add Note, Add Label, or Add Image, when the action completes, then the corresponding element is created through the canvas workflow.
- Given the user chooses Export SVG or Export PNG, when the diagram has exportable content, then the export workflow defined in `006-11-canvas-export.md` starts.
- Given the user chooses Arrange Diagram with ontology nodes present, when persistence completes, then nodes are arranged and connected edges are rerouted as one logical edit.
- Given the user selects Directed Layers, ELK Layered, ELK Force, ELK Mr. Tree, or Grid and chooses Arrange Diagram, when persistence completes, then the selected algorithm determines the node positions while node sizes are preserved.
- Given the user selects ELK Layered, when they set the node or layer gap and choose Arrange Diagram, then the resulting layout uses the configured gaps without persisting those settings in the diagram file.
- Given the diagram contains a directed cycle and the user selects ELK Layered, when Arrange Diagram completes, then the cycle is distributed across layers and its edges receive ELK-computed routes.
- Given the user changes only the layout algorithm selection, when the document is inspected, then the `.odiagram` content is unchanged.
- Given the user chooses Fit, Reset, Zoom In, or Zoom Out, when the viewport changes, then persisted diagram coordinates are unchanged.
- Given an ontology-backed node or edge is selected, when the user chooses Select corresponding model-tree item, then the matching model-tree item is revealed when one exists.
- Given no ontology-backed canvas element is selected, when the user chooses Select corresponding model-tree item, then the user sees a concise problem message.

## Theme Mode

- Given the canvas is in light mode, when the user toggles theme mode, then the canvas rerenders in dark mode and persists `metadata.theme_mode: dark`.
- Given the canvas is in dark mode, when the user toggles theme mode, then the canvas rerenders in light mode and persists `metadata.theme_mode: light`.
- Given the diagram references an `.otheme` file, when theme mode is toggled, then the theme file is not modified.

## Local Element Toolbar

- Given a node is selected, when the local toolbar appears, then Resize to minimum, Create note from ontology comment, and Show related elements are available.
- Given a selected node has no ontology comment, when the local toolbar appears, then Create note from ontology comment is disabled or reports a concise problem.
- Given a node is selected, when the user chooses Show related elements and selects a depth, then related object-property relationships, object-property assertions, and subclass relationships up to that depth are added without duplicating existing nodes or edges.
- Given related data properties exist, when Show related elements runs, then it does not create datatype nodes or data-property edges because data properties are displayed inside nodes.
- Given Show related elements adds nodes or edges, when persistence succeeds, then the canvas shows the added elements without an additional success notification.
- Given a note is selected, when the local toolbar appears, then Resize to compact size and Connect Note are available.
- Given an image or label is selected, when the local toolbar appears, then Resize to minimum is available.
- Given an edge is selected, when the local toolbar appears, then Optimize edge path, a routing-type combobox, Straighten edge, and Remove edge are available.
- Given an edge with `route_layout: direct` is selected, when the local toolbar appears, then its routing-type combobox displays Direct.
- Given an edge is selected, when the user chooses a different routing type in its local-toolbar combobox, then the selected `route_layout` is persisted for that edge.
- Given an edge is selected, when the user chooses Straighten edge, then the persisted route is rewritten as a horizontal or vertical two-point line and the edge label is moved to the new route midpoint.
- Given note or label text editing is active, when the user edits text, then the local toolbar is hidden.

## Style Editing Boundary

- Given a node, edge, note, or label is selected, when the user edits style fields, then those edits are made through the property panel and not the canvas toolbar.
- Given a style edit is persisted, when the active theme file is inspected, then it is unchanged.
