#!/usr/bin/env bash
# Runs inside the official ERPNext image, not on the host.
set -euo pipefail
cd /home/frappe/frappe-bench
ls -1 apps > sites/apps.txt
bench set-config -g db_host db
bench set-config -gp db_port 3306
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379
bench set-config -g redis_socketio redis://redis-queue:6379
bench set-config -gp socketio_port 9000
bench set-config -g chromium_path /usr/lib/chromium/chromium-headless-shell
