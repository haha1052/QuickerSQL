# Fix Editor Left Padding — Checklist

- [x] `glyphMargin` is set to `false` in SQLEditor.tsx Editor options
- [x] `lineNumbersMinChars: 2` is present in Editor options
- [x] `padding: { top: 0, bottom: 0 }` is present in Editor options
- [x] `glyphMarginClassName` is removed from error decoration options
- [x] Error lines are still visually marked (red underline or background) after the change
- [x] `npx tsc --noEmit --pretty` passes with 0 errors
- [x] No other component functionality is affected
