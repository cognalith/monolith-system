#!/bin/bash
# =============================================================================
# MONOLITH OS - Backup Verification Script
# Task: 7.2.1.4 - Create backup verification scripts
# Task: 7.2.1.5 - Test backup restoration process
# =============================================================================

set -euo pipefail

# Configuration
AWS_S3_BUCKET="${AWS_S3_BUCKET:-monolith-backups}"
VERIFICATION_DB_HOST="${VERIFICATION_DB_HOST:-localhost}"
VERIFICATION_DB_PORT="${VERIFICATION_DB_PORT:-5433}"
VERIFICATION_DB_NAME="monolith_verify"
VERIFICATION_DB_USER="${VERIFICATION_DB_USER:-postgres}"
VERIFICATION_DB_PASSWORD="${VERIFICATION_DB_PASSWORD}"

LOG_FILE="/var/log/monolith-backup-verify.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    send_alert "BACKUP VERIFICATION FAILED: $1"
    exit 1
}

send_alert() {
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 $1\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    if [ -n "${PAGERDUTY_ROUTING_KEY:-}" ]; then
        curl -X POST -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_ROUTING_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"$1\",
                    \"severity\": \"critical\",
                    \"source\": \"Monolith OS Backup Verification\"
                }
            }" \
            'https://events.pagerduty.com/v2/enqueue'
    fi
}

log "Starting backup verification..."

# Get latest backup file
LATEST_BACKUP=$(aws s3 ls "s3://$AWS_S3_BUCKET/primary/" | sort | tail -n 1 | awk '{print $4}')

if [ -z "$LATEST_BACKUP" ]; then
    error "No backup files found in S3"
fi

log "Latest backup: $LATEST_BACKUP"

# Download backup
TEMP_DIR=$(mktemp -d)
log "Downloading backup to $TEMP_DIR..."
aws s3 cp "s3://$AWS_S3_BUCKET/primary/$LATEST_BACKUP" "$TEMP_DIR/$LATEST_BACKUP"

# Verify file integrity
log "Verifying file integrity..."
gunzip -t "$TEMP_DIR/$LATEST_BACKUP" || error "Backup file is corrupted"

# Create verification database
log "Creating verification database..."
PGPASSWORD="$VERIFICATION_DB_PASSWORD" psql \
    -h "$VERIFICATION_DB_HOST" \
    -p "$VERIFICATION_DB_PORT" \
    -U "$VERIFICATION_DB_USER" \
    -c "DROP DATABASE IF EXISTS $VERIFICATION_DB_NAME;"

PGPASSWORD="$VERIFICATION_DB_PASSWORD" psql \
    -h "$VERIFICATION_DB_HOST" \
    -p "$VERIFICATION_DB_PORT" \
    -U "$VERIFICATION_DB_USER" \
    -c "CREATE DATABASE $VERIFICATION_DB_NAME;"

# Restore backup
log "Restoring backup to verification database..."
gunzip -c "$TEMP_DIR/$LATEST_BACKUP" | PGPASSWORD="$VERIFICATION_DB_PASSWORD" pg_restore \
    -h "$VERIFICATION_DB_HOST" \
    -p "$VERIFICATION_DB_PORT" \
    -U "$VERIFICATION_DB_USER" \
    -d "$VERIFICATION_DB_NAME" \
    --no-owner \
    --verbose 2>> "$LOG_FILE"

# Verify critical tables exist
log "Verifying critical tables..."
TABLES=("workflows" "tasks" "decision_logs" "dashboard_stats")

for table in "${TABLES[@]}"; do
    count=$(PGPASSWORD="$VERIFICATION_DB_PASSWORD" psql \
        -h "$VERIFICATION_DB_HOST" \
        -p "$VERIFICATION_DB_PORT" \
        -U "$VERIFICATION_DB_USER" \
        -d "$VERIFICATION_DB_NAME" \
        -t -c "SELECT COUNT(*) FROM public.$table;" 2>/dev/null | tr -d ' ')
    
    if [ -z "$count" ]; then
        error "Table $table not found in backup"
    fi
    log "Table $table: $count records"
done

# Calculate RPO (Recovery Point Objective)
BACKUP_TIME=$(echo "$LATEST_BACKUP" | grep -oP '\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}')
BACKUP_EPOCH=$(date -d "${BACKUP_TIME//_/ }" +%s 2>/dev/null || echo "0")
CURRENT_EPOCH=$(date +%s)
RPO_HOURS=$(( (CURRENT_EPOCH - BACKUP_EPOCH) / 3600 ))

log "Current RPO: ${RPO_HOURS} hours"

if [ "$RPO_HOURS" -gt 1 ]; then
    log "WARNING: RPO exceeds 1 hour threshold (current: ${RPO_HOURS} hours)"
    send_alert "RPO Alert: Backup is ${RPO_HOURS} hours old (threshold: 1 hour)"
fi

# Cleanup
log "Cleaning up..."
PGPASSWORD="$VERIFICATION_DB_PASSWORD" psql \
    -h "$VERIFICATION_DB_HOST" \
    -p "$VERIFICATION_DB_PORT" \
    -U "$VERIFICATION_DB_USER" \
    -c "DROP DATABASE IF EXISTS $VERIFICATION_DB_NAME;"

rm -rf "$TEMP_DIR"

log "Backup verification completed successfully!"

# Send success notification
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Monolith OS backup verification passed: $LATEST_BACKUP (RPO: ${RPO_HOURS}h)\"}" \
        "$SLACK_WEBHOOK_URL"
fi

exit 0
