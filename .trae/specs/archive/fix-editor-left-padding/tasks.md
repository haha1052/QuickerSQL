# Fix Editor Left Padding — Tasks

- [x] Task 1: Adjust Monaco Editor options to reduce left padding
  - [x] SubTask 1.1: Change `glyphMargin` from `true` to `false`
  - [x] SubTask 1.2: Add `lineNumbersMinChars: 2` to minimize line number gutter width
  - [x] SubTask 1.3: Add `padding: { top: 0, bottom: 0 }` to remove content padding

- [x] Task 2: Fix error decoration after glyphMargin disabled
  - [x] SubTask 2.1: Remove `glyphMarginClassName` from decoration options
  - [x] SubTask 2.2: Ensure `className` + `linesDecorationsClassName` still visually marks error lines

# Task Dependencies
- Task 2 depends on Task 1 (glyphMargin must be disabled first)
