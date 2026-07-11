# Acceptance Tests: Canvas Edges

## Create Edges

- Given a connection-capable ontology item has exactly one resolved source and target, when it is dropped on the canvas, then an ontology-backed edge is created.
- Given either endpoint is missing from the canvas, when the edge is created, then the missing endpoint node is created before the edge is persisted.
- Given both endpoint nodes are missing, when the edge is created, then the source node is placed left of the drop point and the target node right of the drop point.
- Given an endpoint is missing or ambiguous, when the relationship is dropped, then the drop is rejected and the `.odiagram` file is unchanged.
- Given more than one existing node matches a resolved endpoint, when the relationship is dropped, then the drop is rejected and the user sees a clear endpoint-duplicate message.
- Given an edge with the same `ontology_ref`, `source`, and `target` already exists, when the same relationship is dropped, then the user sees a duplicate-edge message and no duplicate is written.

## Preview And Persistence

- Given a connection-capable ontology item is dragged over the canvas, when source and target are valid, then a temporary edge preview shows the route, endpoints, validity, and required node creation.
- Given a preview is invalid, when the user drops the item, then no edge or endpoint nodes are persisted.
- Given edge creation completes, when the `.odiagram` file is updated, then the edge has a generated `edge_` id, source, target, ontology reference, route points, and label point.

## Edit Edges

- Given a connected source or target node moves or resizes, when the diagram is persisted, then the first or last edge point is recalculated and intermediate points are preserved.
- Given connected source and target elements move together as part of one keyboard multi-selection move, when the diagram is persisted, then the edge route points and label are translated by the same offset instead of being rerouted.
- Given the user moves an edge label, when the drag completes, then the persisted edge `label` point is updated.
- Given an edge endpoint has a matching OWL cardinality restriction, when the edge renders, then the cardinality is shown as a separate label near that endpoint.
- Given the user drags an edge cardinality label, when the drag completes, then only that label position is persisted in the edge's corresponding cardinality-label point.
- Given the user edits an edge route with canvas route handles, when the edit completes, then persisted route `points` are updated and `source` and `target` identifiers are unchanged.
- Given the user selects an edge route layout in the property panel, when the edit commits, then `route_layout` is updated and route `points` are preserved.
- Given the user chooses optimize edge path, when the edge has stale route points, then the route is recalculated from current endpoint bounds.

## Note Connections

- Given a note is selected, when the user chooses Connect Note and selects a node, image, or another note, then a dotted note connection edge is persisted.
- Given the same two elements are already connected, when the user tries to create the note connection again, then the action is rejected and the `.odiagram` file is unchanged.
- Given a note connection edge is deleted, when persistence completes, then neither endpoint element is deleted.

## UML Mapping

- Given a subclass relationship edge renders, when the scene is drawn, then it uses a hollow triangle arrowhead toward the superclass node.
- Given an object or data property edge renders, when the scene is drawn, then it uses a solid line with an open arrowhead toward the target node.
