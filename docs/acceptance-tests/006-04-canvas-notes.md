# Acceptance Tests: Canvas Notes

## Add And Edit Notes

- Given the add-note command runs, when the user enters note content, then a `note_` element is added to the `.odiagram` `notes` section.
- Given a note is created, when it is persisted, then it stores `id`, `x`, `y`, `width`, `height`, and `text`, and omits `style` unless customized.
- Given the user edits note text, when the edit commits, then the persisted `text` field is updated.
- Given note text contains supported basic HTML, when rendered, then supported formatting appears and unsupported or unsafe markup is sanitized by rendering rules.

## Move And Resize

- Given a note is selected, when the user drags it, then persisted `x` and `y` are updated and dimensions are unchanged.
- Given a note resize handle is dragged, when the resize completes, then dimensions and any affected top-left coordinate are updated.
- Given a resize would create non-positive or unusably small dimensions, when completed, then the action is rejected and the document remains unchanged.

## Delete Notes

- Given a note is selected, when the user requests deletion, then the editor asks for confirmation before changing the document.
- Given the user confirms note deletion, when persistence completes, then the note is removed from the `.odiagram` `notes` section.
- Given the user cancels note deletion, when the confirmation closes, then the document remains unchanged.

## Note Connections And Export

- Given a note is selected, when the local toolbar is shown, then a connect-note action is available.
- Given a note is connected to another element, when the opposing element is deleted, then the connecting edge is removed and the note remains.
- Given Include in Export is disabled for a note, when persistence completes, then the note stores `export: false`.
- Given Include in Export is enabled again, when persistence completes, then the serialized note omits `export`.
