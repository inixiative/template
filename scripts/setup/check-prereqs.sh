#!/bin/bash
set -e

command -v bun &> /dev/null || { echo "Error: Bun not installed"; exit 1; }
command -v docker &> /dev/null || { echo "Error: Docker not installed"; exit 1; }
docker info &> /dev/null || { echo "Error: Docker not running"; exit 1; }
