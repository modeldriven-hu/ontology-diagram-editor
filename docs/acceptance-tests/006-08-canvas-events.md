# Acceptance Tests: Canvas Events

## Event Payloads

- Given the canvas opens a `.odiagram` file, when the webview initializes, then `Canvas opened` is emitted with the diagram file path.
- Given the canvas renders or rerenders, when rendering completes, then `Canvas rendered` includes diagram file path, rendered element identifiers, and warnings.
- Given selection changes, when the event is emitted, then it includes diagram file path, selected element identifier, and selected element type.
- Given a drag starts, changes, completes, or cancels, when the event is emitted, then it includes diagram file path, element identifier, drag kind, and the relevant geometry payload.

## Editing Events

- Given a node is created, when persistence runs, then `Canvas node created`, `Diagram document updated`, and `Diagram save requested` are emitted.
- Given an edge preview changes, when validity, endpoints, route, or pointer position changes, then `Canvas edge preview changed` includes preview points, valid state, and rejection reason.
- Given an edge is created, when persistence completes, then `Canvas edge created` includes source, target, ontology reference, points, and any created node identifiers.
- Given text, style, property, image source, or deletion edits complete, when events are emitted, then each event includes the changed element identifiers and changed fields.

## Persistence Events

- Given a document edit is applied, when persistence starts, then `Diagram document updated` and `Diagram save requested` are emitted.
- Given the disk save succeeds, when persistence completes, then `Diagram saved` is emitted.
- Given document update or disk save fails, when persistence fails, then `Diagram save failed` includes the failure stage and error message.
