# Acceptance Tests: Canvas Property Panel

## Visibility And Selection

- Given the canvas view is open, when the property panel is expanded, then it is docked to the side and does not permanently block work on the selected element.
- Given the user resizes or collapses the panel, when the `.odiagram` file is saved, then panel width and collapsed state are not persisted.
- Given no element is selected, when the panel is shown, then it displays read-only diagram context.
- Given one element is selected, when the panel updates, then it shows the element type, read-only identifier, and supported fields for that element type.

## Editable Fields

- Given a node is selected, when the panel is shown, then `x`, `y`, `width`, `height`, `image`, and `show_data_properties` are editable.
- Given an individual node is selected, when the panel is shown, then `show_type`, `show_property_values`, and `property_value_text_overflow` are editable.
- Given an edge is selected, when the panel is shown, then route layout is editable and endpoints, route points, and label position are not editable.
- Given a note is selected, when the panel is shown, then `text`, geometry, and Include in Export are editable.
- Given a note, label, or image is selected, when the panel is shown, then only the version 1 editable fields for that element type are editable.
- Given a node image or standalone image source is edited, when a local file is selected, then the selected image bytes are embedded as a `data:image/...` URI.
- Given a node or standalone image is selected, when its image field is displayed, then the panel indicates that the image is embedded without exposing an editable data URI.
- Given a node has an embedded image, when the user clears it, then the node image field is removed.
- Given an image is selected, when the Style tab is shown, then image border type, border weight, border color, and drop shadow are editable.

## Validation And Persistence

- Given a field edit would create non-positive dimensions, an invalid image source, or invalid text length, when committed, then the edit is rejected and the document remains unchanged.
- Given a text field edit is in progress, when the user presses `Escape`, then the last committed value is restored.
- Given a text field loses focus or the user presses `Enter`, when the value is valid, then the edit is committed as one logical document change.
- Given a property panel edit is persisted, when events are emitted, then `Canvas property edited`, `Diagram document updated`, and `Diagram save requested` are emitted.
- Given the selected element is removed externally, when the panel refreshes, then stale selection is cleared and the no-selection state is shown.
