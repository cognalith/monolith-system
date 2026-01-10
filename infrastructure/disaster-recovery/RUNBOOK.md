# Monolith OS Disaster Recovery Runbook

## Task: 7.2.2.1 - Document recovery procedures
## Task: 7.2.2.2 - Create runbooks for failure scenarios

---

## Table of Contents
1. [Recovery Objectives](#recovery-objectives)
2. [Emergency Contacts](#emergency-contacts)
3. [Failure Scenarios](#failure-scenarios)
4. [Recovery Procedures](#recovery-procedures)
5. [Post-Recovery Checklist](#post-recovery-checklist)

---

## Recovery Objectives

| Metric | Target | Current Capability |
|--------|--------|-------------------|
| RTO (Recovery Time Objective) | < 4 hours | 2-3 hours |
| RPO (Recovery Point Objective) | < 1 hour | 1 hour (daily backups) |
| Data Loss Tolerance | Minimal | Last backup point |

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| DevOps Lead | devops@cognalith.com | PagerDuty |
| Database Admin | dba@cognalith.com | PagerDuty |
| Security Team | security@cognalith.com | PagerDuty |
| Supabase Support | support@supabase.io | Dashboard |
| Vercel Support | support@vercel.com | Dashboard |

---

## Failure Scenarios

### Scenario 1: Database Corruption/Loss

**Symptoms:**
- Application errors related to database queries
- 500 errors on API endpoints
- Supabase dashboard shows database unavailable

**Recovery Steps:**

1. **Assess the situation**
   \`\`\`bash
   # Check Supabase status
   curl -s https://status.supabase.com/api/v2/status.json | jq .status
   \`\`\`

2. **Notify stakeholders**
   \`\`\`bash
   ./infrastructure/monitoring/send-alert.sh "DATABASE INCIDENT: Starting recovery"
   \`\`\`

3. **Initiate recovery from backup**
   \`\`\`bash
   # List available backups
   aws s3 ls s3://monolith-backups/primary/ --recursive | tail -10
   
   # Download latest backup
   aws s3 cp s3://monolith-backups/primary/[BACKUP_FILE] /tmp/recovery/
   \`\`\`

4. **Restore to new Supabase project** (if needed)
   - Create new Supabase project via dashboard
   - Use pg_restore to restore data
   \`\`\`bash
   PGPASSWORD=$NEW_DB_PASSWORD pg_restore \
     -h db.[NEW_PROJECT_REF].supabase.co \
     -U postgres \
     -d postgres \
     --no-owner \
     /tmp/recovery/[BACKUP_FILE]
   \`\`\`

5. **Update environment variables**
   - Update Vercel environment variables with new database URL
   - Redeploy frontend

6. **Verify recovery**
   \`\`\`bash
   ./infrastructure/backup/verify-backup.sh
   \`\`\`

**Estimated Recovery Time:** 2-3 hours

---

### Scenario 2: Frontend/Vercel Deployment Failure

**Symptoms:**
- Website returns 500/502 errors
- Vercel dashboard shows failed deployments
- SSL certificate errors

**Recovery Steps:**

1. **Check Vercel status**
   \`\`\`bash
   curl -s https://www.vercel-status.com/api/v2/status.json | jq .status
   \`\`\`

2. **Rollback to previous deployment**
   - Go to Vercel Dashboard > Deployments
   - Find last successful deployment
   - Click "..." > "Promote to Production"

3. **If rollback fails, redeploy from Git**
   \`\`\`bash
   # Force redeploy from main branch
   vercel --prod --force
   \`\`\`

4. **Verify SSL certificate**
   \`\`\`bash
   echo | openssl s_client -servername monolith-system.vercel.app \
     -connect monolith-system.vercel.app:443 2>/dev/null | \
     openssl x509 -noout -dates
   \`\`\`

**Estimated Recovery Time:** 15-30 minutes

---

### Scenario 3: Security Breach/Intrusion

**Symptoms:**
- Unusual API activity patterns
- Unauthorized access alerts
- Data exfiltration detected

**Immediate Actions:**

1. **Isolate the system**
   \`\`\`bash
   # Pause Supabase project
   # Via Dashboard: Project Settings > Pause Project
   
   # Disable Vercel deployment
   vercel env rm SUPABASE_URL production
   \`\`\`

2. **Rotate all credentials**
   - Supabase database password
   - API keys
   - JWT secrets
   - Service account credentials

3. **Review audit logs**
   \`\`\`bash
   # Check Supabase logs
   # Dashboard > Logs > Auth logs
   
   # Check Vercel logs
   vercel logs --prod
   \`\`\`

4. **Notify security team and stakeholders**

5. **Document incident for post-mortem**

**Estimated Recovery Time:** 4-8 hours

---

### Scenario 4: Region-wide Outage

**Symptoms:**
- Complete service unavailability
- Cloud provider status page shows regional incident

**Recovery Steps:**

1. **Activate geo-redundant backup**
   \`\`\`bash
   # Switch to secondary region backup
   aws s3 cp s3://monolith-backups/secondary/[LATEST_BACKUP] /tmp/recovery/
   \`\`\`

2. **Deploy to alternate region**
   - Create new Supabase project in different region
   - Restore from backup
   - Update DNS/environment variables

3. **Communicate with users**
   - Update status page
   - Send email notification

**Estimated Recovery Time:** 3-4 hours

---

## Post-Recovery Checklist

- [ ] All services operational
- [ ] Data integrity verified
- [ ] Monitoring alerts cleared
- [ ] Stakeholders notified of resolution
- [ ] Incident timeline documented
- [ ] Root cause identified
- [ ] Post-mortem scheduled
- [ ] Preventive measures identified

---

## Appendix: Quick Commands

\`\`\`bash
# Check backup status
aws s3 ls s3://monolith-backups/primary/ | tail -5

# Verify database connectivity
PGPASSWORD=$DB_PASSWORD psql -h db.$PROJECT_REF.supabase.co -U postgres -c "SELECT 1"

# Check Vercel deployment status
vercel ls --prod

# Run backup verification
./infrastructure/backup/verify-backup.sh

# Send test alert
./infrastructure/monitoring/send-alert.sh "TEST: This is a test alert"
\`\`\`

---

*Last Updated: $(date +%Y-%m-%d)*
*Document Owner: DevOps Team*
*Review Frequency: Monthly*
