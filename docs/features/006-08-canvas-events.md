# Canvas Events

This specification defines the event architecture for canvas behavior.

# Scope

This specification covers canvas events and event payloads. The behavior that triggers
the events is defined in the relevant canvas feature specifications.

# Events

The canvas shall be event based. User gestures, model tree drops, file updates, and
persistence operations shall produce events that other parts of the extension can
subscribe to.

Events shall include enough payload data for subscribers to update rendering, model tree
selection, validation state, command enablement, and persistence state without inspecting
DOM state.

| Event | Trigger | Payload |
|-------|---------|---------|
| Canvas opened | A `.odiagram` file is opened in the canvas view | Diagram file path |
| Canvas rendered | The canvas renders or rerenders the diagram | Diagram file path, rendered element identifiers, warnings |
| Canvas validation changed | Diagram validation warnings or errors change | Diagram file path, warnings, errors |
| Canvas selection changed | The selected canvas element or selection set changes | Diagram file path, selected element identifier, selected element type, selected element identifiers |
| Canvas viewport changed | The user pans, zooms, fits, resets, or reveals an element in the canvas viewport | Diagram file path, pan x, pan y, zoom, change source |
| Canvas drag started | The user starts dragging a selected canvas element, resize handle, or edge label | Diagram file path, element identifier, drag kind, initial geometry |
| Canvas drag changed | The user moves a selected element, resize handle, or edge label during a drag | Diagram file path, element identifier, drag kind, preview geometry |
| Canvas drag completed | The user completes a move, resize, or edge label drag | Diagram file path, element identifier, changed fields |
| Canvas drag canceled | The user cancels an active canvas drag | Diagram file path, element identifier, drag kind |
| Model tree item dropped on canvas | A model tree ontology item is dropped on the canvas | Diagram file path, ontology file path, ontology item type, ontology item reference, display label, ontology item metadata, canvas point |
| Canvas node created | A node is created from an ontology item or edge materialization | Diagram file path, node identifier, ontology item reference, bounds, creation source |
| Canvas edge preview started | A connection-capable ontology item starts edge creation | Diagram file path, ontology item type, ontology item reference |
| Canvas edge preview changed | The temporary edge preview changes source, target, route, pointer position, or validity | Diagram file path, ontology item reference, source node identifier, target node identifier, preview points, valid state, rejection reason |
| Canvas edge created | An edge is completed and persisted | Diagram file path, edge identifier, source node identifier, target node identifier, ontology item reference, points, created node identifiers |
| Canvas edge route changed | An existing edge endpoint is recalculated after node geometry changes, or an edge label position changes | Diagram file path, edge identifier, points, label point |
| Canvas label created | A standalone label is created | Diagram file path, label identifier, text, position |
| Canvas note created | A note is created | Diagram file path, note identifier, text, bounds |
| Canvas image created | An image is created | Diagram file path, image identifier, source, bounds |
| Canvas image source changed | An image source is changed | Diagram file path, image identifier, source |
| Canvas text edited | A note or label text value changes | Diagram file path, element identifier, element type, text |
| Canvas style changed | A canvas control changes an element-level style | Diagram file path, element identifier, element type, changed style fields |
| Canvas property panel visibility changed | The side property panel is initialized, collapsed, or expanded | Diagram file path, visible state, collapsed state, panel height |
| Canvas property edited | A property panel field changes a persisted element property | Diagram file path, element identifier, element type, changed fields |
| Canvas elements deleted | One or more elements are removed from the diagram | Diagram file path, removed element identifiers, affected edge identifiers |
| Canvas undo requested | The user invokes undo from a canvas shortcut or control | Diagram file path |
| Canvas redo requested | The user invokes redo from a canvas shortcut or control | Diagram file path |
| Diagram document updated | A canvas or model tree action applies a valid edit to the opened `.odiagram` text document | Diagram file path, change source, changed element identifiers |
| Diagram save requested | The extension requests a disk save for the updated `.odiagram` document | Diagram file path, change source, changed element identifiers |
| Diagram saved | The updated `.odiagram` file is successfully saved to disk | Diagram file path, changed element identifiers |
| Diagram save failed | The `.odiagram` document edit or disk save fails | Diagram file path, changed element identifiers, failure stage, error message |
