#!/bin/bash
# =============================================================================
# MONOLITH OS - Supabase Database Backup Script
# Task: 7.2.1.1 - Configure automated daily backups
# Task: 7.2.1.2 - Set up geo-redundant backup storage
# =============================================================================

set -euo pipefail

# Configuration
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-nhjnywarhnmlszudcqdl}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD}"
SUPABASE_DB_HOST="db.${SUPABASE_PROJECT_REF}.supabase.co"
SUPABASE_DB_PORT="5432"
SUPABASE_DB_NAME="postgres"
SUPABASE_DB_USER="postgres"

# Backup settings
BACKUP_DIR="/tmp/backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="monolith_backup_${DATE}.sql.gz"
RETENTION_DAYS=30

# S3 Configuration for geo-redundant storage
AWS_S3_BUCKET="${AWS_S3_BUCKET:-monolith-backups}"
AWS_S3_REGION_PRIMARY="${AWS_S3_REGION_PRIMARY:-us-east-1}"
AWS_S3_REGION_SECONDARY="${AWS_S3_REGION_SECONDARY:-eu-west-1}"

# Logging
LOG_FILE="/var/log/monolith-backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    exit 1
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting database backup for Monolith OS..."

# Perform database dump
log "Creating database dump..."
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
    -h "$SUPABASE_DB_HOST" \
    -p "$SUPABASE_DB_PORT" \
    -U "$SUPABASE_DB_USER" \
    -d "$SUPABASE_DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    2>> "$LOG_FILE" | gzip > "$BACKUP_DIR/$BACKUP_FILE"

if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    error "Backup file was not created"
fi

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
log "Backup created: $BACKUP_FILE (Size: $BACKUP_SIZE)"

# Upload to primary S3 region
log "Uploading to primary S3 region ($AWS_S3_REGION_PRIMARY)..."
aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" \
    "s3://$AWS_S3_BUCKET/primary/$BACKUP_FILE" \
    --region "$AWS_S3_REGION_PRIMARY" \
    --storage-class STANDARD_IA \
    --sse AES256

# Upload to secondary S3 region (geo-redundant)
log "Uploading to secondary S3 region ($AWS_S3_REGION_SECONDARY)..."
aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" \
    "s3://$AWS_S3_BUCKET/secondary/$BACKUP_FILE" \
    --region "$AWS_S3_REGION_SECONDARY" \
    --storage-class STANDARD_IA \
    --sse AES256

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
aws s3 ls "s3://$AWS_S3_BUCKET/primary/" | \
    while read -r line; do
        file_date=$(echo "$line" | awk '{print $1}')
        file_name=$(echo "$line" | awk '{print $4}')
        if [[ $(date -d "$file_date" +%s) -lt $(date -d "-$RETENTION_DAYS days" +%s) ]]; then
            aws s3 rm "s3://$AWS_S3_BUCKET/primary/$file_name" --region "$AWS_S3_REGION_PRIMARY"
            aws s3 rm "s3://$AWS_S3_BUCKET/secondary/$file_name" --region "$AWS_S3_REGION_SECONDARY"
            log "Deleted old backup: $file_name"
        fi
    done

# Cleanup local file
rm -f "$BACKUP_DIR/$BACKUP_FILE"

log "Backup completed successfully!"

# Send notification (Slack webhook)
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Monolith OS backup completed: $BACKUP_FILE ($BACKUP_SIZE)\"}" \
        "$SLACK_WEBHOOK_URL"
fi

exit 0
