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

## Delete Images

- Given an image is selected, when the user requests deletion, then the editor asks for confirmation before changing the document.
- Given the user confirms image deletion, when persistence completes, then the image is removed from the `.odiagram` `images` section.
- Given the user cancels image deletion, when the confirmation closes, then the document remains unchanged.
