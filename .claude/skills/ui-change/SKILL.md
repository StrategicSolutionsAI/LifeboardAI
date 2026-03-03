# UI Change Workflow

Follow this process strictly when implementing any UI change.

## Step 1: Understand the Request
- Read the target file(s) to understand current UI structure
- Identify the closest existing UI pattern in the codebase (edit modal, popover, context menu, etc.)

## Step 2: Propose Approach (BEFORE writing any code)
Present to the user:
1. **Files to change**: List every file that will be modified
2. **Placement**: Where exactly the new UI element will go (e.g., "inside the task edit modal, below the due date field")
3. **Pattern to follow**: Reference a specific existing component/pattern being matched

Wait for user approval before proceeding.

## Step 3: Implement
- Consolidate new actions into existing UI patterns — do NOT scatter buttons/controls across multiple views
- Match the styling of surrounding elements (use `@/lib/styles` tokens)
- Use existing Shadcn UI components where possible

## Step 4: Verify
- Run `npx tsc --noEmit` to check for type errors
- Take a preview screenshot if available to visually confirm the change
- Confirm the change matches what was approved in Step 2
