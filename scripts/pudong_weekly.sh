#!/bin/bash
# 浦易达政策抓取 - 每周日晚上10点
# 用法: crontab -e → 0 22 * * 0 /path/to/pudong_weekly.sh

set -e

PROJECT_DIR="/Users/els/property-match-tauri"
VENV_PYTHON="/Users/els/.venv/bin/python"
OUTPUT_JSON="$PROJECT_DIR/data/pudong_policies.json"
LOG_FILE="/tmp/pudong_weekly.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始抓取浦易达政策..." >> "$LOG_FILE"

cd "$PROJECT_DIR"

$VENV_PYTHON scripts/pudong_fetch.py \
    --output "$OUTPUT_JSON" \
    2>&1 | tee -a "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 抓取完成，commit..." >> "$LOG_FILE"

git add data/pudong_policies.json
git commit -m "chore: sync pudong policies $(date '+%Y-%m-%d')" || true
git push

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 完成" >> "$LOG_FILE"
