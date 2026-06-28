# Acceptance Tests: Canvas Property Panel

## Visibility And Selection

- Given the canvas view is open, when the property panel is expanded, then it is docked to the bottom and does not permanently block work on the selected element.
- Given the user resizes or collapses the panel, when the `.odiagram` file is saved, then panel height and collapsed state are not persisted.
- Given no element is selected, when the panel is shown, then it displays read-only diagram context.
- Given one element is selected, when the panel updates, then it shows the element type, read-only identifier, and supported fields for that element type.

## Editable Fields

- Given a node is selected, when the panel is shown, then `x`, `y`, `width`, `height`, and `image` are editable.
- Given an edge is selected, when the panel is shown, then edge fields are inspection-only and endpoints, route points, and label position are not editable.
- Given a note, label, or image is selected, when the panel is shown, then only the version 1 editable fields for that element type are editable.
- Given a node image or standalone image source is edited, when a local file is selected, then the path is persisted relative to the `.odiagram` file.
- Given a data URI image source is entered, when validation succeeds, then it is persisted.

## Validation And Persistence

- Given a field edit would create non-positive dimensions, an invalid image source, or invalid text length, when committed, then the edit is rejected and the document remains unchanged.
- Given a text field edit is in progress, when the user presses `Escape`, then the last committed value is restored.
- Given a text field loses focus or the user presses `Enter`, when the value is valid, then the edit is committed as one logical document change.
- Given a property panel edit is persisted, when events are emitted, then `Canvas property edited`, `Diagram document updated`, and `Diagram save requested` are emitted.
- Given the selected element is removed externally, when the panel refreshes, then stale selection is cleared and the no-selection state is shown.
