#!/usr/bin/env bash
# Sourced by prepush.sh; keep this helper compatible with macOS Bash 3.2.

prune_old_docker_build_cache() {
  local qa_cache_df qa_cache_bytes
  if ! qa_cache_df="$(docker system df --format '{{.Type}} {{.Size}}' 2>/dev/null)"; then
    echo "[qa] could not read Docker cache usage; skipping cache prune" >&2
    return 0
  fi

  # Docker reports decimal SI sizes, e.g. 350kB, 820.5MB, or 5.2GB.
  qa_cache_bytes="$(printf '%s\n' "$qa_cache_df" | awk '
    $1 == "Build" && $2 == "Cache" {
      size = $3
      if (size !~ /^[0-9]+([.][0-9]+)?[A-Za-z]+$/) exit
      amount = size; sub(/[A-Za-z]+$/, "", amount)
      unit = size; sub(/^[0-9.]+/, "", unit)
      if (unit == "B") factor = 1
      else if (unit == "kB" || unit == "KB") factor = 1000
      else if (unit == "MB") factor = 1000000
      else if (unit == "GB") factor = 1000000000
      else if (unit == "TB") factor = 1000000000000
      else exit
      printf "%.0f\n", amount * factor
      exit
    }
  ')"

  if [[ -z "$qa_cache_bytes" ]]; then
    echo "[qa] could not parse Docker build cache size; skipping cache prune" >&2
    return 0
  fi
  if awk -v bytes="$qa_cache_bytes" 'BEGIN { exit !(bytes > 5000000000) }'; then
    # Only unused build cache older than 72 hours is eligible. Never prune images or volumes.
    docker builder prune -f --filter until=72h || return 1
    echo "[qa] pruned Docker build cache"
  fi
  return 0
}
