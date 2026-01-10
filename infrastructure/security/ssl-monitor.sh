#!/bin/bash
# =============================================================================
# MONOLITH OS - SSL/TLS Certificate Monitoring
# Task: 7.0.2.4 - Configure SSL certificate auto-renewal
# Task: 7.0.2.5 - Set up TLS monitoring and alerts
# =============================================================================

set -euo pipefail

# Configuration
DOMAINS=(
    "monolith-system.vercel.app"
    "nhjnywarhnmlszudcqdl.supabase.co"
)

ALERT_THRESHOLD_DAYS=30
CRITICAL_THRESHOLD_DAYS=7
LOG_FILE="/var/log/ssl-monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_alert() {
    local severity="$1"
    local message="$2"
    
    log "$severity: $message"
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color="warning"
        [ "$severity" = "CRITICAL" ] && color="danger"
        
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"🔐 SSL Certificate Alert\",
                    \"text\": \"$message\",
                    \"fields\": [{\"title\": \"Severity\", \"value\": \"$severity\", \"short\": true}]
                }]
            }" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    # PagerDuty notification for critical alerts
    if [ "$severity" = "CRITICAL" ] && [ -n "${PAGERDUTY_ROUTING_KEY:-}" ]; then
        curl -s -X POST -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_ROUTING_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"SSL Certificate: $message\",
                    \"severity\": \"critical\",
                    \"source\": \"Monolith OS SSL Monitor\"
                }
            }" \
            'https://events.pagerduty.com/v2/enqueue'
    fi
}

check_certificate() {
    local domain="$1"
    
    log "Checking SSL certificate for $domain..."
    
    # Get certificate expiration date
    local expiry_date
    expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
                  openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -z "$expiry_date" ]; then
        send_alert "CRITICAL" "Unable to retrieve SSL certificate for $domain"
        return 1
    fi
    
    # Calculate days until expiration
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch
    current_epoch=$(date +%s)
    local days_remaining=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    log "Certificate for $domain expires in $days_remaining days ($expiry_date)"
    
    # Check TLS version
    local tls_version
    tls_version=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
                  grep "Protocol" | awk '{print $3}')
    
    log "TLS version for $domain: $tls_version"
    
    # Alert if using older TLS versions
    if [[ "$tls_version" =~ TLSv1\.[01] ]]; then
        send_alert "WARNING" "$domain is using outdated TLS version: $tls_version"
    fi
    
    # Check certificate validity
    if [ "$days_remaining" -le "$CRITICAL_THRESHOLD_DAYS" ]; then
        send_alert "CRITICAL" "SSL certificate for $domain expires in $days_remaining days!"
    elif [ "$days_remaining" -le "$ALERT_THRESHOLD_DAYS" ]; then
        send_alert "WARNING" "SSL certificate for $domain expires in $days_remaining days"
    else
        log "SSL certificate for $domain is valid (expires in $days_remaining days)"
    fi
    
    # Output JSON for monitoring systems
    echo "{
        \"domain\": \"$domain\",
        \"expiry_date\": \"$expiry_date\",
        \"days_remaining\": $days_remaining,
        \"tls_version\": \"$tls_version\",
        \"status\": \"$([ $days_remaining -le $CRITICAL_THRESHOLD_DAYS ] && echo 'critical' || ([ $days_remaining -le $ALERT_THRESHOLD_DAYS ] && echo 'warning' || echo 'ok'))\"
    }"
}

# Main execution
log "Starting SSL certificate monitoring..."

results=()
for domain in "${DOMAINS[@]}"; do
    result=$(check_certificate "$domain")
    results+=("$result")
done

# Output combined results
echo "["
printf '%s\n' "${results[@]}" | sed '$!s/$/,/'
echo "]"

log "SSL certificate monitoring completed"
