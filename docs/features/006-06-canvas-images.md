# Canvas Images

This specification defines canvas behavior for standalone images.

# Scope

This specification covers adding images, moving images, resizing images, and persisting
image sources.

# Add Images

The canvas shall provide a command for adding a standalone image.

When the user adds an image, the canvas shall ask for an image file using a file picker.
The selected source shall be a file path allowed by the `.odiagram` image source rules.

The new image shall:

- Use a generated unique `id` using the `image_` prefix.
- Store the insertion position as `x` and `y`.
- Store default width and height selected by the implementation or derived from the image
  dimensions.
- Store the selected image source as `source`.

If the source is a file path, it shall be persisted relative to the `.odiagram` file.

Data URI image sources are valid `.odiagram` values, but in version 1 they are entered
or edited through the property panel rather than the add-image command.

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
