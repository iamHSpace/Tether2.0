# Statvora Brand Assets

Replace the files in this folder with final brand assets when ready.

## Files

| File | Used in | Format | Notes |
|---|---|---|---|
| `logo-icon.svg` | Sidebar, Login, Signup page headers | SVG, 24×24 viewBox | Square/favicon variant — white strokes on brand-600 background |
| `logo-icon-dark.svg` | AdminSidebar (dark background) | SVG, 24×24 viewBox | Same shape, optimised for dark (#1a1a2e / gray-900) backgrounds |
| `logo-wordmark.svg` | OG image, email templates | SVG, 160×32 viewBox | Horizontal: icon + "Statvora" text side by side |

## How the logo is used in code

All logo icon references in JSX use an **inline `<img>` pointing to `/brand/logo-icon.svg`** so you only need to swap the file — no code changes required.

```tsx
// Pattern used everywhere:
<img src="/brand/logo-icon.svg" width={16} height={16} alt="Statvora" />
```

The OG image (`/app/c/[username]/opengraph-image.tsx`) references `/brand/logo-wordmark.svg`.

## Replacing logos

1. Export your icon as SVG with a 24×24 viewBox, white paths (it sits inside a `bg-brand-600` container)
2. Overwrite `logo-icon.svg` with the new file
3. If your dark-bg variant differs, also overwrite `logo-icon-dark.svg`
4. For the wordmark, export as SVG ~160×32 and overwrite `logo-wordmark.svg`
5. Redeploy — no code changes needed
