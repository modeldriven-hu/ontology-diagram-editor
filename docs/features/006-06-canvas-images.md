# Canvas Images

This specification defines canvas behavior for standalone images.

# Scope

This specification covers adding images, moving images, resizing images, deleting
images, persisting image sources, and editing image borders and shadows.

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
- Use the default image appearance, which has no border and no drop shadow.

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

When an image is selected, the local element toolbar shall provide a resize-to-minimum
action.

# Image Borders And Shadows

Standalone images shall support the same border override fields as nodes: border type,
border weight, and border color. Standalone images shall also support enabling or
disabling drop shadow.

If no image border or shadow override is persisted, the renderer shall use the default
image appearance: no border and no drop shadow.

Image border edits shall be persisted in the image `style.border` map. Image drop shadow
edits shall be persisted in the image `style.shadow` field. Both shall apply to canvas
rendering and diagram exports.

# Delete Images

The user can delete a selected image from the canvas.

When the user requests image deletion, the editor shall ask for confirmation before
modifying the `.odiagram` document. If the user confirms, the image shall be removed
from the `images` section and connected edges shall be removed from the `edges` section.
If the user cancels, the document shall remain unchanged.
