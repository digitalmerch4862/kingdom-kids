# Ask AI MVP Contract

- `answer`: AI returns text only, no pending mutation
- `confirm`: AI returns a previewable action, but nothing is saved yet
- `error`: UI shows failure state and no write action is available
- Allowed MVP action types:
  - `add_points`
- Disallowed in MVP:
  - arbitrary SQL
  - arbitrary field edits
  - silent writes
