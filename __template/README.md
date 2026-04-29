# __template

Committed seeds for gitignored directories.

When a gitignored area needs useful starting state (initial memory, default
configs, golden rules), the seed lives here so new environments don't start blank.

| Folder | Seeds | Target |
|--------|-------|--------|
| `__template/volumes/` | Volume config defaults | `volumes/` (gitignored) |

## Usage

Seeds are applied automatically during `bun run init` or `bun run setup`.
To manually apply: copy the relevant subfolder contents to the target location.
