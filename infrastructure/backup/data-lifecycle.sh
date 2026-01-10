#!/bin/bash
# =============================================================================
# MONOLITH OS - Data Lifecycle Management
# Task: 7.2.3.1 - Implement automated data archival
# Task: 7.2.3.2 - Create data destruction scripts
# =============================================================================

set -euo pipefail

# Configuration
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-nhjnywarhnmlszudcqdl}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD}"
SUPABASE_DB_HOST="db.${SUPABASE_PROJECT_REF}.supabase.co"

AWS_S3_BUCKET="${AWS_S3_BUCKET:-monolith-backups}"
ARCHIVE_BUCKET="${ARCHIVE_BUCKET:-monolith-archive}"

# Retention policies (in days)
ACTIVE_RETENTION=90
ARCHIVE_RETENTION=365
PERMANENT_DELETE=730

LOG_FILE="/var/log/data-lifecycle.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Archive old data to cold storage
archive_data() {
    log "Starting data archival process..."
    
    local archive_date=$(date -d "-${ACTIVE_RETENTION} days" +%Y-%m-%d)
    local archive_file="archive_$(date +%Y%m%d).sql.gz"
    
    # Export data older than retention period
    log "Exporting data older than $archive_date..."
    
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        -h "$SUPABASE_DB_HOST" \
        -U postgres \
        -d postgres \
        -c "
        COPY (
            SELECT * FROM decision_logs 
            WHERE timestamp < '$archive_date'
        ) TO STDOUT WITH CSV HEADER
        " | gzip > "/tmp/$archive_file"
    
    # Upload to archive bucket (Glacier)
    log "Uploading archive to S3 Glacier..."
    aws s3 cp "/tmp/$archive_file" \
        "s3://$ARCHIVE_BUCKET/decision_logs/$archive_file" \
        --storage-class GLACIER
    
    # Record archived data in audit log
    log "Recording archive in audit log..."
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        -h "$SUPABASE_DB_HOST" \
        -U postgres \
        -d postgres \
        -c "
        INSERT INTO data_archive_log (archive_date, table_name, file_name, record_count, status)
        SELECT 
            NOW(),
            'decision_logs',
            '$archive_file',
            COUNT(*),
            'archived'
        FROM decision_logs 
        WHERE timestamp < '$archive_date'
        ON CONFLICT DO NOTHING;
        "
    
    # Delete archived data from main database
    log "Removing archived data from main database..."
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        -h "$SUPABASE_DB_HOST" \
        -U postgres \
        -d postgres \
        -c "
        DELETE FROM decision_logs 
        WHERE timestamp < '$archive_date';
        "
    
    # Cleanup local file
    rm -f "/tmp/$archive_file"
    
    log "Data archival completed"
}

# Securely destroy data past permanent retention
destroy_data() {
    log "Starting secure data destruction process..."
    
    local destroy_date=$(date -d "-${PERMANENT_DELETE} days" +%Y-%m-%d)
    
    # List archives to be destroyed
    log "Identifying archives older than $destroy_date for destruction..."
    
    aws s3 ls "s3://$ARCHIVE_BUCKET/" --recursive | while read -r line; do
        file_date=$(echo "$line" | awk '{print $1}')
        file_path=$(echo "$line" | awk '{print $4}')
        
        if [[ $(date -d "$file_date" +%s) -lt $(date -d "-$PERMANENT_DELETE days" +%s) ]]; then
            log "Destroying: $file_path"
            
            # Record destruction in audit log before deletion
            PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
                -h "$SUPABASE_DB_HOST" \
                -U postgres \
                -d postgres \
                -c "
                INSERT INTO data_destruction_log (destruction_date, file_path, destruction_method, operator)
                VALUES (NOW(), '$file_path', 'S3 DELETE', 'automated');
                "
            
            # Perform secure deletion
            aws s3 rm "s3://$ARCHIVE_BUCKET/$file_path"
        fi
    done
    
    log "Data destruction completed"
}

# Generate data retention report
generate_report() {
    log "Generating data retention report..."
    
    local report_file="/tmp/retention_report_$(date +%Y%m%d).json"
    
    # Query database for retention statistics
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        -h "$SUPABASE_DB_HOST" \
        -U postgres \
        -d postgres \
        -t -A -c "
        SELECT json_build_object(
            'report_date', NOW(),
            'tables', json_agg(table_stats)
        )
        FROM (
            SELECT 
                table_name,
                COUNT(*) as total_records,
                MIN(created_at) as oldest_record,
                MAX(created_at) as newest_record
            FROM information_schema.tables t
            JOIN (
                SELECT 'workflows' as tn UNION
                SELECT 'tasks' UNION
                SELECT 'decision_logs'
            ) tables ON t.table_name = tables.tn
            WHERE table_schema = 'public'
            GROUP BY table_name
        ) table_stats;
        " > "$report_file"
    
    # Add S3 archive statistics
    archive_count=$(aws s3 ls "s3://$ARCHIVE_BUCKET/" --recursive | wc -l)
    archive_size=$(aws s3 ls "s3://$ARCHIVE_BUCKET/" --recursive --human-readable | awk '{total += $3} END {print total}')
    
    log "Report generated: $report_file"
    log "Active archives: $archive_count files"
    
    cat "$report_file"
}

# Create audit log tables if not exist
init_audit_tables() {
    log "Initializing audit tables..."
    
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        -h "$SUPABASE_DB_HOST" \
        -U postgres \
        -d postgres \
        -c "
        CREATE TABLE IF NOT EXISTS data_archive_log (
            id SERIAL PRIMARY KEY,
            archive_date TIMESTAMP DEFAULT NOW(),
            table_name VARCHAR(255),
            file_name VARCHAR(255),
            record_count INTEGER,
            status VARCHAR(50)
        );
        
        CREATE TABLE IF NOT EXISTS data_destruction_log (
            id SERIAL PRIMARY KEY,
            destruction_date TIMESTAMP DEFAULT NOW(),
            file_path VARCHAR(500),
            destruction_method VARCHAR(100),
            operator VARCHAR(100)
        );
        "
    
    log "Audit tables initialized"
}

# Main execution
case "${1:-}" in
    archive)
        archive_data
        ;;
    destroy)
        destroy_data
        ;;
    report)
        generate_report
        ;;
    init)
        init_audit_tables
        ;;
    full)
        init_audit_tables
        archive_data
        destroy_data
        generate_report
        ;;
    *)
        echo "Usage: $0 {archive|destroy|report|init|full}"
        echo ""
        echo "Commands:"
        echo "  archive - Archive data older than ${ACTIVE_RETENTION} days"
        echo "  destroy - Permanently delete data older than ${PERMANENT_DELETE} days"
        echo "  report  - Generate data retention report"
        echo "  init    - Initialize audit tables"
        echo "  full    - Run complete lifecycle management"
        exit 1
        ;;
esac

log "Data lifecycle management completed"
