# Ask AI Production Checklist

This checklist is tailored to the current Kingdom Kids Ask AI implementation.

## Current Direction

The app already follows several strong patterns:

- Ask AI requests are routed through a server endpoint at `api/ask-ai.ts`
- UI responses use a safe structured contract:
  - `answer`
  - `confirm`
  - `error`
- Confirmed writes go through existing app logic instead of direct prompt-driven mutation
- Read-only sessions are separated from write-capable sessions
- Tests cover Ask AI service and page behavior

## Production Checklist

### 1. Security

- [ ] Keep all AI provider keys server-side only
- [ ] Do not use `VITE_` env vars for Ask AI secrets
- [ ] Restrict write-capable actions to approved roles only
- [ ] Re-check permissions server-side before executing writes
- [ ] Add rate limiting on `/api/ask-ai`
- [ ] Add request timeout handling for AI calls

### 2. Response Safety

- [ ] Require structured JSON output from the model
- [ ] Validate model output before returning it to the UI
- [ ] Reject unsupported action types
- [ ] Reject malformed student/action payloads
- [ ] Keep unsupported requests in `answer` or `error` mode only

### 3. Write Action Safety

- [ ] Keep all writes behind explicit confirmation UI
- [ ] Allow only one approved write action at a time
- [ ] Reuse business logic services for every mutation
- [ ] Enforce points validation before save
- [ ] Enforce daily limits before save
- [ ] Require actor identity on every confirmed mutation
- [ ] Write audit logs for AI-suggested actions

### 4. Deterministic Fallbacks

- [ ] Prefer local deterministic answers for common questions
- [ ] Use AI only when interpretation is truly needed
- [ ] Keep fallback coverage for:
  - absent students
  - follow-up list
  - leaderboard
  - roster count
  - student points
- [ ] Return graceful fallback answers if the AI provider is down

### 5. Data Quality

- [ ] Handle ambiguous student names safely
- [ ] Ask for clarification when multiple students match
- [ ] Prefer full name or access key matching for write actions
- [ ] Validate category names against allowed point categories
- [ ] Prevent invalid or negative point changes unless explicitly supported

### 6. UX

- [ ] Keep example prompts visible for staff
- [ ] Show read-only banner when writes are disabled
- [ ] Show exactly what will be saved before confirmation
- [ ] Make success/failure states obvious
- [ ] Keep `Clear Chat` available to reset state fast
- [ ] Avoid long, multi-action prompts in guidance text

### 7. Testing

- [ ] Keep unit tests for Ask AI service normalization
- [ ] Keep page tests for confirmation flow
- [ ] Add tests for permission failures
- [ ] Add tests for ambiguous student matches
- [ ] Add tests for provider failure fallback
- [ ] Add tests for server-side response validation

### 8. Monitoring

- [ ] Log Ask AI request outcomes
- [ ] Track fallback usage
- [ ] Track confirmation success/failure
- [ ] Track rejected/invalid write attempts
- [ ] Track unresolved student matching prompts

## Recommended Next Upgrades

Implement these in order:

1. Deterministic-first router
   Route common prompts to local code before calling the model.

2. Ambiguous student resolution
   If more than one student matches, return a clarification response instead of guessing.

3. Strong server-side validation
   Validate returned action payloads against allowed categories, points rules, and student resolution before the UI sees them.

4. Audit trail for Ask AI writes
   Log who asked, what was proposed, who confirmed, and what was saved.

5. Additional safe actions
   Only after the above is stable:
   - `void_points`
   - follow-up draft generation
   - read-only recommendations

## Best-Practice Design Rule

Treat Ask AI as a supervised assistant:

- AI interprets
- app validates
- user confirms
- service layer writes

Do not let the model become the source of truth for student records or points.
