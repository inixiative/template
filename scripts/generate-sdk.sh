#!/bin/bash
set -euo pipefail

bun --cwd apps/api generate:openapi
bun --cwd packages/sdk generate:sdk
bun --cwd packages/ui generate:msw
