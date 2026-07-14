# Acceptance Tests: Model Tree

## Display Ontologies

- Given a `.odiagram` file references ontology files, when the model tree loads, then the root node represents the diagram and direct children represent referenced ontology files in document order.
- Given an ontology file loads successfully, when the tree expands it, then ontology items are grouped by supported item type and sorted by display label or stable source order.
- Given classes have subclass relationships, when the Classes group expands, then root classes appear at the group level and subclasses are nested below their in-ontology superclasses.
- Given a class has multiple in-ontology superclasses, when those superclasses expand, then the class appears below each of them with a valid parent path.
- Given subclass declarations contain a cycle, when the Classes group expands, then every class remains reachable and ancestors do not repeat indefinitely.
- Given a diagram is open, when Filter Model Tree is invoked and a matching result becomes active, then the model tree expands its ancestor path and selects the matching ontology item.
- Given a diagram is open, when Show Unadded Ontology Elements is invoked for one ontology, then the tree shows only that ontology's addable items that are not already materialized as diagram nodes or concrete relationship edges.
- Given the unadded-elements filter is active for an ontology, when the command is invoked for that ontology again, then the normal unfiltered tree is restored.
- Given an ontology file cannot be loaded, when the tree refreshes, then the ontology file node remains visible with an error status.
- Given the currently displayed diagram editor is closed and no other diagram editor is active, when the model tree refreshes, then the tree is empty and diagram-dependent commands are disabled.
- Given two diagram custom-editor tabs are open, when the user activates the other tab, then the model tree refreshes from that tab's `.odiagram` document.
- Given two diagram custom-editor tabs are open, when the user closes the inactive tab, then the active diagram remains displayed in the model tree.
- Given the active diagram custom-editor tab is closed while another diagram tab becomes visible, when editor state settles, then the model tree displays the remaining active diagram.

## Ontology Metadata

- Given ontology items are parsed, when tree nodes are created, then each item node exposes display label, full reference, source ontology path, item type, and runtime metadata.
- Given a class has no explicit label or compact namespace display, when its model-tree item is displayed, then the visible label uses the local IRI name and the raw URL is kept out of the row description.
- Given an ontology item has multiple domains, ranges, class assertions, or equivalent references, when metadata is exposed, then all values are preserved.
- Given a subclass relationship is parsed, when its model-tree item is displayed, then the label shows the subclass name, a subclass glyph, and the superclass name instead of only the relationship predicate.
- Given an object or data property has a domain and range, when its model-tree item is displayed, then the property name remains the primary label and the domain/range names are shown in the row description or tooltip instead of the raw property reference.
- Given a subclass relationship node is dragged, when the drag event is emitted, then metadata includes concrete subclass and superclass endpoints.

## Selection And Drag

- Given a user selects an ontology item, when the selection event is emitted, then it includes the selected node kind, ontology item type, ontology item reference, display label, and runtime metadata.
- Given a user selects an ontology-backed canvas element and invokes Select corresponding model-tree item, when the item exists in the model tree, then the model tree selects the corresponding ontology item.
- Given a user drags an ontology item node, when dragging starts, then `Model tree item dragged` is emitted with the ontology item payload.
- Given a group, ontology file, or diagram node is shown, when the user attempts to drag it, then it is not draggable.

## Open Ontology Source

- Given a referenced ontology file node is selected, when the user invokes Open Ontology File, then the ontology file opens in the built-in text editor.
- Given an ontology item node is selected, when the user invokes Open Ontology Source, then the ontology file opens and reveals the best available source location for that item.
- Given an ontology item source location cannot be found, when Open Ontology Source runs, then the ontology file still opens and the user receives a concise informational message.

## Dependency Refresh

- Given an open `.odiagram` references an ontology file, when that ontology file is saved in the built-in text editor, then the model tree reloads the referenced ontology data.
- Given a diagram editor is open, when a referenced ontology file changes inside or outside Visual Studio Code, then the editor refreshes its ontology-derived canvas data.
- Given a referenced ontology is deleted or recreated, when the filesystem event is received, then the canvas and active model tree refresh to show the current dependency state.
- Given the diagram changes an ontology reference, when dependency tracking refreshes, then the old file is no longer watched and the new file is watched.
- Given Refresh Diagram Dependencies is invoked, when reloading completes, then both the active model tree and the current diagram canvas are refreshed.

## Add And Remove Ontologies

- Given a `.odiagram` file is open, when the user adds a supported ontology file, then the relative ontology path is appended to `ontologies`, the file is loaded, and the tree refreshes.
- Given the selected ontology is already referenced, when the user adds it, then the file is not added twice and the existing ontology node is selected.
- Given the user removes an ontology and confirms, when persistence succeeds, then the ontology reference and dependent diagram nodes and edges are removed while notes, labels, and images remain.
- Given the user cancels ontology removal, when the dialog closes, then the `.odiagram` file is unchanged.
