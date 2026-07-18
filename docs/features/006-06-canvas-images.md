# Canvas Images

This specification defines canvas behavior for standalone images.

# Scope

This specification covers adding images, moving images, resizing images, deleting
images, persisting image sources, and editing image borders and shadows.

# Add Images

The canvas shall provide a command for adding a standalone image.

When the user adds an image, the canvas shall show a searchable built-in icon-gallery
dialog with icon previews and an icon-set selector, plus a separate action for choosing
an image file. The gallery shall provide an icon-color chooser, initialized to the
current blue icon color. Its previews and selected SVG shall use the chosen color. The
bundled gallery shall include Material Design Icons, Bootstrap Icons,
and Carbon for additional enterprise, cloud, data, and infrastructure coverage. Icon
sets shall be loaded on demand so opening a diagram does not load every icon. The
selected image file or icon shall be embedded into the `.odiagram` file as a data URI
image source so diagrams remain portable without copying external image files.

The new image shall:

- Use a generated unique `id` using the `image_` prefix.
- Store the insertion position as `x` and `y`.
- Store default width and height selected by the implementation or derived from the image
  dimensions.
- Store the embedded data URI image source as `source`.
- Use the default image appearance, which has no border and no drop shadow.

Relative file paths, absolute file paths, and remote URLs are not supported image
sources in version 1.

The Image property shall provide a Select action. When a node has an assigned image, it
shall additionally provide a Clear action; the Clear action shall not be displayed for
a node without an image. Clearing it shall remove the persisted node `image` value.
An assigned gallery icon shall additionally provide an Icon Color property that
recolors its embedded SVG without rasterizing it. Uploaded images and unrelated SVGs
shall not display the gallery-icon color property.

When image selection is requested from the Properties view, the icon-gallery dialog
shall be displayed over the diagram canvas rather than inside the Properties view.

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
