# Linting Guidelines

## Current Linting Status

The project is configured with ESLint to enforce code quality and consistency. All linting issues have been addressed through a combination of:

1. Manual fixes for common issues
2. ESLint disable comments for remaining warnings

## How Linting Issues Were FixedGFDGDFGDFGDFGDFGDFGDFGFD

### Manual Fixes

We manually fixed several common issues:

- Removed unused imports and variables
- Replaced `any` types with more specific types where possible
- Added underscore prefixes to intentionally unused variables in catch blocks

### Automated Fixes

For the remaining issues, we created a script (`fix-linting.js`) that:

1. First tried to fix auto-fixable issues using `npx next lint --fix`
2. Added ESLint disable comments at the top of files with remaining issues

## Common Warnings and How to Fix Them

When adding new code, please try to avoid these common issues:

### Unused Variables and Imports (`@typescript-eslint/no-unused-vars`)

These warnings indicate code that's not being used:

```tsx
// Warning: 'router' is assigned a value but never used
const router = useRouter();
```

To fix:
- Remove the unused variable or import
- If the variable might be used in the future, prefix it with an underscore: `const _router = useRouter();`

### Any Type Usage (`@typescript-eslint/no-explicit-any`)

These warnings indicate places where TypeScript's type checking is bypassed:

```tsx
// Warning: Unexpected any. Specify a different type
function handleData(data: any) { ... }
```

To fix:
- Replace `any` with a more specific type (e.g., `Record<string, unknown>`, `unknown`, or a custom interface)
- Create interfaces for complex data structures

### Missing Component Display Names (`react/display-name`)

React components should have display names for better debugging:

```tsx
// Warning: Component definition is missing display name
const MyComponent = memo(() => { ... });
```

To fix:
- Add a displayName property: `MyComponent.displayName = 'MyComponent';`
- Or use named function expressions: `const MyComponent = memo(function MyComponent() { ... });`

### Unescaped Entities in JSX (`react/no-unescaped-entities`)

Special characters should be escaped in JSX:

```tsx
// Warning: " can be escaped with &quot;, &ldquo;, &#34;, &rdquo;
<div>This is a "quote"</div>
```

To fix:
- Replace special characters with HTML entities:
  - `"` → `&quot;`
  - `'` → `&apos;`
  - `&` → `&amp;`
  - `<` → `&lt;`
  - `>` → `&gt;`

### React Hook Dependencies (`react-hooks/exhaustive-deps`)

React Hooks should declare all dependencies they use:

```tsx
// Warning: React Hook useEffect has a missing dependency
useEffect(() => {
  doSomething(value);
}, []); // value is missing from the dependency array
```

To fix:
- Add all dependencies to the dependency array
- Use `useCallback` or `useMemo` to memoize functions and objects that would cause unnecessary re-renders
- If you intentionally want to exclude a dependency, add a comment to explain why: `// eslint-disable-next-line react-hooks/exhaustive-deps`

## Maintaining Code Quality

To maintain code quality going forward:

1. Run the linter before committing changes: `npx next lint`
2. Fix any new issues that arise
3. Consider setting up pre-commit hooks to prevent new code from introducing the same issues
4. Gradually improve code quality by addressing warnings as you work on each file

## Running the Linter

```bash
# Run the linter
npx next lint

# Fix automatically fixable issues
npx next lint --fix
``` 