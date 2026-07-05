# Acceptance Tests: Model Tree

## Display Ontologies

- Given a `.odiagram` file references ontology files, when the model tree loads, then the root node represents the diagram and direct children represent referenced ontology files in document order.
- Given an ontology file loads successfully, when the tree expands it, then ontology items are grouped by supported item type and sorted by display label or stable source order.
- Given an ontology file cannot be loaded, when the tree refreshes, then the ontology file node remains visible with an error status.
- Given the currently displayed diagram editor is closed, when the model tree refreshes, then the tree is empty and diagram-dependent commands are disabled.

## Ontology Metadata

- Given ontology items are parsed, when tree nodes are created, then each item node exposes display label, full reference, source ontology path, item type, and runtime metadata.
- Given an ontology item has multiple domains, ranges, class assertions, or equivalent references, when metadata is exposed, then all values are preserved.
- Given a subclass relationship node is dragged, when the drag event is emitted, then metadata includes concrete subclass and superclass endpoints.

## Selection And Drag

- Given a user selects an ontology item, when the selection event is emitted, then it includes the selected node kind, ontology item type, ontology item reference, display label, and runtime metadata.
- Given a user selects an ontology-backed canvas element and invokes Select corresponding model-tree item, when the item exists in the model tree, then the model tree selects the corresponding ontology item.
- Given a user drags an ontology item node, when dragging starts, then `Model tree item dragged` is emitted with the ontology item payload.
- Given a group, ontology file, or diagram node is shown, when the user attempts to drag it, then it is not draggable.

## Add And Remove Ontologies

- Given a `.odiagram` file is open, when the user adds a supported ontology file, then the relative ontology path is appended to `ontologies`, the file is loaded, and the tree refreshes.
- Given the selected ontology is already referenced, when the user adds it, then the file is not added twice and the existing ontology node is selected.
- Given the user removes an ontology and confirms, when persistence succeeds, then the ontology reference and dependent diagram nodes and edges are removed while notes, labels, and images remain.
- Given the user cancels ontology removal, when the dialog closes, then the `.odiagram` file is unchanged.
