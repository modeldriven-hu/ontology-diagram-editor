# Acceptance Tests: Canvas Images

## Add Images

- Given the add-image command runs, when the user selects a valid local image file, then an `image_` element is added to the `.odiagram` `images` section.
- Given an image is created from a file path, when it is persisted, then the path is stored relative to the `.odiagram` file.
- Given the user wants to use a data URI source, when editing in version 1, then the value is entered or edited through the property panel rather than the add-image command.
- Given a remote URL image source is entered, when validation runs, then the value is rejected.

## Move And Resize

- Given an image is selected, when the user drags it, then persisted `x` and `y` are updated and dimensions are unchanged.
- Given an image resize handle is dragged, when the resize completes, then dimensions and any affected top-left coordinate are updated.
- Given a resize would create non-positive or unusably small dimensions, when completed, then the action is rejected and the document remains unchanged.
