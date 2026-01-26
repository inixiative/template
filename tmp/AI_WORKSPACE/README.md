# AI Workspace

Staging area for Claude to work on tasks. Changes here are reviewed before being copied to the main repo.

## Structure

```
AI_WORKSPACE/
├── README.md
├── {task-name}/
│   ├── TASK.md          # Task description, status, notes
│   ├── files/           # Files to be copied to repo
│   │   └── path/to/file.ts  # Mirrors repo structure
│   └── notes/           # Research, drafts, experiments
```

## Workflow

1. Claude creates a task folder
2. Works on files in `files/` mirroring repo structure
3. Updates TASK.md with status and notes
4. User reviews and approves
5. Files get copied to main repo
6. Task folder can be deleted

## Active Tasks

(none yet)
