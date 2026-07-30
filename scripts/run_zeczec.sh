#!/bin/bash
# Zeczecクローラーを環境変数付きで実行
set -a
source "$(dirname "$0")/../.env.local"
set +a

cd "$(dirname "$0")"
python3 crawl_zeczec.py "$@"
