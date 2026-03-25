# Agent Skills

External skills that extend AI agent capabilities. Skills are **not stored in the repo** — they're installed via symlink or plugin registry.

## Quick start

```bash
# Install skills-cli skills (react-best-practices, web-design-guidelines, etc.)
bash AI/skills/sync.sh

# Also show plugin install commands (superpowers, etc.)
bash AI/skills/sync.sh --all
```

Or use the package.json shortcut:

```bash
bun run setup:skills
```

## How it works

- `manifest.json` declares which skills to install and from where
- `sync.sh` installs them using `bunx skills add` (symlinked, not copied)
- Plugin skills (like superpowers) require an interactive agent session to install

## Manifest format

```json
{
  "skills": [
    {
      "name": "skill-name",
      "source": "org/repo",
      "method": "skills-cli | plugin",
      "description": "What this skill does"
    }
  ]
}
```

## Adding new skills

1. Add an entry to `manifest.json`
2. Run `bash AI/skills/sync.sh`
3. Commit the manifest update
