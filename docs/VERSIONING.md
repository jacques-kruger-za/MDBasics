# Versioning

MDBasics uses SemVer-style versions.

## Current Baseline

`0.1.0` is the MVP baseline:

- Markdown code editing is the primary editable surface.
- Rendered and Diff are read-only support views.
- WYSIWYG editing is intentionally paused.
- Windows installer packaging is available through Electron Builder.

The canonical MVP tag is `v0.1.0`. The earlier `v0.1.0-mvp` tag is kept as a historical alias.

## Version Rules

- Patch: `0.1.x`
  - Bug fixes and polish to the MVP scope.
  - No major editing model changes.
- Prerelease: `0.2.0-alpha.x`
  - WYSIWYG experiments and iteration builds.
  - Expected to change quickly and occasionally break editing edge cases.
- Minor: `0.2.0`
  - First stable WYSIWYG-capable release.
  - Rendered editing must round-trip Markdown reliably enough for normal use.

## Release Flow

1. Make and verify changes.

   ```powershell
   npm run verify
   npm audit
   ```

2. Set the intended version.

   MVP patch:

   ```powershell
   npm version patch -m "Release v%s"
   ```

   WYSIWYG prerelease:

   ```powershell
   npm version 0.2.0-alpha.1 -m "Release v%s"
   ```

   Next WYSIWYG prerelease:

   ```powershell
   npm version prerelease --preid alpha -m "Release v%s"
   ```

3. Build the installer.

   ```powershell
   npm run release:win
   ```

4. Push commits and tags.

   ```powershell
   git push
   git push --tags
   ```

## Installer Naming

Installer artifacts use:

```text
MDBasics-<version>-Setup-<arch>.exe
```

Example:

```text
MDBasics-0.2.0-alpha.1-Setup-x64.exe
```
