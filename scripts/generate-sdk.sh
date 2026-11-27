#!/bin/bash
set -euo pipefail

bun --cwd apps/api generate:openapi
bun --cwd packages/sdk generate:sdk
