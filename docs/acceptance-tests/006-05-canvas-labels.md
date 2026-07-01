# Acceptance Tests: Canvas Labels

## Add And Edit Labels

- Given the add-label command runs, when the user enters label text, then a `label_` element is added to the `.odiagram` `labels` section.
- Given a label is created, when it is persisted, then it stores `id`, `x`, `y`, `width`, `height`, and `text`, and omits `style` unless customized.
- Given the user edits label text, when the edit commits, then the persisted `text` field is updated.

## Move And Bounds

- Given a label is selected, when the user drags it, then persisted `x` and `y` are updated.
- Given a label resize handle is dragged, when the resize completes, then dimensions and any affected top-left coordinate are updated.
- Given a resize would create non-positive or unusably small dimensions, when completed, then the action is rejected and the document remains unchanged.

## Delete Labels

- Given a label is selected, when the user requests deletion, then the editor asks for confirmation before changing the document.
- Given the user confirms label deletion, when persistence completes, then the label is removed from the `.odiagram` `labels` section.
- Given the user cancels label deletion, when the confirmation closes, then the document remains unchanged.
