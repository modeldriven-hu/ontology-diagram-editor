# Acceptance Tests: Canvas Labels

## Add And Edit Labels

- Given the add-label command runs, when the user enters label text, then a `label_` element is added to the `.odiagram` `labels` section.
- Given a label is created, when it is persisted, then it stores `id`, `x`, `y`, and `text`, and omits `style` unless customized.
- Given the user edits label text, when the edit commits, then the persisted `text` field is updated.

## Move And Bounds

- Given a label is selected, when the user drags it, then persisted `x` and `y` are updated.
- Given a label is selected, when selection affordances are shown, then move affordances are available and resize affordances are not.
- Given a label renders, when its bounds are calculated, then rendered bounds are derived from text and font rather than persisted width or height.
