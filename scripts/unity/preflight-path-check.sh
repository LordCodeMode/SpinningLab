#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${UNITY_PROJECT_PATH:-$HOME/Developer/Unity/training-world}"
BUILD_ROOT="${UNITY_BUILD_ROOT:-$HOME/Developer/UnityBuilds/training-dashboard}"

contains_segment() {
  local path="$1"
  local segment="$2"
  [[ "$path" == *"$segment"* ]]
}

is_disallowed_path() {
  local path="$1"

  if [[ "$path" == "$HOME/Library/Mobile Documents"* ]]; then
    return 0
  fi

  if [[ "$path" == "$HOME/Desktop"* ]]; then
    return 0
  fi

  if [[ "$path" == "$HOME/Documents"* ]]; then
    return 0
  fi

  if contains_segment "$path" "/.Trash/"; then
    return 0
  fi

  return 1
}

if is_disallowed_path "$PROJECT_PATH"; then
  echo "[ERROR] UNITY_PROJECT_PATH points to an iCloud/trash-sensitive location: $PROJECT_PATH" >&2
  echo "        Move the project under ~/Developer/Unity (or another local non-iCloud path)." >&2
  exit 1
fi

if is_disallowed_path "$BUILD_ROOT"; then
  echo "[ERROR] UNITY_BUILD_ROOT points to an iCloud/trash-sensitive location: $BUILD_ROOT" >&2
  exit 1
fi

if [[ ! -d "$PROJECT_PATH" ]]; then
  echo "[ERROR] Unity project path does not exist: $PROJECT_PATH" >&2
  exit 1
fi

for required in Assets Packages ProjectSettings; do
  if [[ ! -d "$PROJECT_PATH/$required" ]]; then
    echo "[ERROR] Missing Unity folder: $PROJECT_PATH/$required" >&2
    exit 1
  fi
done

mkdir -p "$BUILD_ROOT"

echo "[OK] Preflight passed"
echo "UNITY_PROJECT_PATH=$PROJECT_PATH"
echo "UNITY_BUILD_ROOT=$BUILD_ROOT"
