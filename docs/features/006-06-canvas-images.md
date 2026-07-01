# Canvas Images

This specification defines canvas behavior for standalone images.

# Scope

This specification covers adding images, moving images, resizing images, deleting
images, and persisting image sources.

# Add Images

The canvas shall provide a command for adding a standalone image.

When the user adds an image, the canvas shall ask for an image file using a file picker.
The selected image file shall be embedded into the `.odiagram` file as a data URI image
source so diagrams remain portable without copying external image files.

The new image shall:

- Use a generated unique `id` using the `image_` prefix.
- Store the insertion position as `x` and `y`.
- Store default width and height selected by the implementation or derived from the image
  dimensions.
- Store the embedded data URI image source as `source`.

Relative file path image sources are valid `.odiagram` values for compatibility and
typed/property-panel editing, but the add-image command shall not create external file
links.

Remote URL image sources are not supported in version 1.

# Move Images

The user can move an image by dragging the selected image.

Moving an image shall update its persisted `x` and `y` fields. The canvas shall keep the
image dimensions unchanged.

# Resize Images

The user can resize an image by dragging resize handles.

Resizing an image shall update its persisted `width` and `height` fields. If the resize
handle changes the top or left edge, the persisted `x` or `y` field shall also be
updated.

The canvas shall enforce a positive width and height and minimum dimensions that keep
image handles usable.

# Delete Images

The user can delete a selected image from the canvas.

When the user requests image deletion, the editor shall ask for confirmation before
modifying the `.odiagram` document. If the user confirms, the image shall be removed
from the `images` section. If the user cancels, the document shall remain unchanged.
