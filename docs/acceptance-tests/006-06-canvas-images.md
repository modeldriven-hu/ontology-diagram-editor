# Acceptance Tests: Canvas Images

## Add Images

- Given the add-image command runs, when the user selects a valid local image file, then an `image_` element is added to the `.odiagram` `images` section.
- Given an image is created from a local file selection, when it is persisted, then the selected image bytes are embedded in `source` as a `data:image/...` URI.
- Given an image is created from a local file selection, when the `.odiagram` file is moved without the original image file, then the embedded image source remains renderable.
- Given a remote URL image source is entered, when validation runs, then the value is rejected.

## Move And Resize

- Given an image is selected, when the user drags it, then persisted `x` and `y` are updated and dimensions are unchanged.
- Given an image resize handle is dragged, when the resize completes, then dimensions and any affected top-left coordinate are updated.
- Given a resize would create non-positive or unusably small dimensions, when completed, then the action is rejected and the document remains unchanged.

## Borders And Shadows

- Given an image is selected, when the user edits border type, weight, or color, then the image `style.border` map is persisted.
- Given an image is selected, when the user enables or disables drop shadow, then the image `style.shadow` field is persisted.
- Given an image has no border or shadow override, when the canvas or export renderer draws it, then the image is shown without border and without drop shadow.
- Given an image has persisted border or shadow overrides, when the canvas or export renderer draws it, then those overrides are used.
- Given an image style is cleared, when the diagram is persisted, then the image falls back to no border and no drop shadow.

## Delete Images

- Given an image is selected, when the user requests deletion, then the editor asks for confirmation before changing the document.
- Given the user confirms image deletion, when persistence completes, then the image is removed from the `.odiagram` `images` section.
- Given the deleted image has connected edges, when image deletion is persisted, then those edges are removed from the `.odiagram` `edges` section.
- Given the user cancels image deletion, when the confirmation closes, then the document remains unchanged.
