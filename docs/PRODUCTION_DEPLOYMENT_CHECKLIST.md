# AHSO CRM — Production Deployment Checklist

**Last Updated:** 2026-04-28
**Status:** Staging-ready / production with conditions
**Version:** v1.0.0

Use this checklist to ensure all prerequisites are met before, during, and after production deployment.

---

## PRE-DEPLOYMENT CHECKLIST (48 hours before)

### Configuration & Secrets

- [ ] **Environment Files Prepared**
  - [ ] `.env.production.local` created and filled
  - [ ] `backend/.env.production.local` created and filled
  - [ ] `frontend/.env.production.local` created and filled
  - [ ] All secrets are **strong random values** (not defaults)
  - [ ] Secrets stored in secure location (e.g., 1Password, HashiCorp Vault)

- [ ] **Critical Environment Variables**
  - [ ] `POSTGRES_PASSWORD` — strong random (32+ chars)
  - [ ] `JWT_SECRET` — strong random (32+ chars)
  - [ ] `JWT_RESET_SECRET` — strong random (32+ chars)
  - [ ] `FRONTEND_URL` — correct production domain
  - [ ] `CORS_ORIGIN` — production domain only (no localhost)
  - [ ] `NODE_ENV=production`
  - [ ] `SWAGGER_ENABLED=false` (or absent)

- [ ] **Optional But Recommended**
  - [ ] `SENTRY_DSN` — error tracking configured
  - [ ] `LOG_LEVEL=info` (not debug)
  - [ ] `ANTHROPIC_API_KEY` (if AI features used)
  - [ ] `SMTP_*` vars (if email enabled)

### Infrastructure Preparation

- [ ] **Database**
  - [ ] PostgreSQL 16 installed on production server
  - [ ] Database `ahso_crm` created
  - [ ] User `ahso` created with strong password
  - [ ] Backup location identified and tested
  - [ ] Backup schedule configured
  - [ ] Recovery procedure tested at least once

- [ ] **Redis**
  - [ ] Redis 7 installed on production server
  - [ ] Redis is accessible only to backend service (not internet-facing)
  - [ ] Persistence configured (RDB or AOF)

- [ ] **Storage**
  - [ ] `/backend/uploads` directory exists on production server
  - [ ] Sufficient disk space available (≥ 10 GB recommended)
  - [ ] Directory owned by appropriate user
  - [ ] Backup includes uploads directory

- [ ] **Networking**
  - [ ] Port 3001 (backend) is accessible only from internal/reverse proxy
  - [ ] Port 3000 (frontend) is accessible from internet (via reverse proxy/TLS)
  - [ ] Port 5432 (database) is NOT internet-exposed
  - [ ] Port 6379 (redis) is NOT internet-exposed
  - [ ] Firewall rules configured
  - [ ] TLS/SSL certificates installed and valid

### Monitoring & Logging

- [ ] **Monitoring Setup**
  - [ ] Error rate tracking configured (Sentry, DataDog, CloudWatch)
  - [ ] Latency/response time alerts configured
  - [ ] Database connection pool monitoring active
  - [ ] Disk space alert configured (trigger if > 80% used)
  - [ ] Memory usage alert configured

- [ ] **Logging**
  - [ ] Log aggregation configured (optional but recommended)
  - [ ] Log retention policy set (e.g., 30 days)
  - [ ] Winston logs being shipped to centralized location
  - [ ] Log search/analysis tool accessible to ops team

- [ ] **Health Checks**
  - [ ] Monitoring configured to check `GET /api/health` every 60 seconds
  - [ ] Alert configured if health check fails
  - [ ] Dashboard shows health status

### Backup & Recovery

- [ ] **Database Backup**
  - [ ] PostgreSQL backup tested
  - [ ] Backup restores successfully on test server
  - [ ] Backup schedule: daily or more frequent
  - [ ] Backup retention: at least 7 days

- [ ] **Uploads Backup**
  - [ ] `/backend/uploads` included in backup strategy
  - [ ] Can restore uploads from backup

- [ ] **Recovery Plan**
  - [ ] Documented: how to restore database from backup
  - [ ] Documented: how to restore uploads
  - [ ] Tested: recovery procedure works (at least once)

### Team & Documentation

- [ ] **Team Ready**
  - [ ] Ops team trained on deployment procedure
  - [ ] On-call rotation established
  - [ ] Escalation contacts identified
  - [ ] Incident response plan reviewed

- [ ] **Documentation Complete**
  - [ ] Production runbook available to ops team
  - [ ] Health check interpretation guide available
  - [ ] Rollback procedure documented and tested
  - [ ] Common troubleshooting steps documented

- [ ] **Communication Plan**
  - [ ] Stakeholders notified of maintenance window (if any)
  - [ ] Slack/email channel established for incident coordination
  - [ ] Status page configured (if applicable)

---

## STAGING VALIDATION CHECKLIST (2-3 days before production)

### Deploy to Staging

- [ ] **Environment Matches Production**
  - [ ] Same PostgreSQL version
  - [ ] Same Redis version
  - [ ] Same Node.js version
  - [ ] Similar hardware/sizing (or larger)

- [ ] **Deployment Successful**
  - [ ] Docker images built successfully
  - [ ] docker-compose pull succeeds
  - [ ] docker-compose up succeeds
  - [ ] All services report healthy
  - [ ] Database migrations run cleanly

### Smoke Tests

- [ ] **Login Works**
  - [ ] Can login as admin@ahso.vn / AHSO123!
  - [ ] Can login as manager@ahso.vn / AHSO123!
  - [ ] Can login as staff@ahso.vn / AHSO123!
  - [ ] Invalid credentials rejected

- [ ] **Core Workflows**
  - [ ] Create customer: works
  - [ ] Create project: works
  - [ ] Create quote: works
  - [ ] Generate quote PDF: works
  - [ ] Create contract: works
  - [ ] Accept contract: works

- [ ] **Admin Functions**
  - [ ] Access admin panel: works
  - [ ] View users: works
  - [ ] View roles/permissions: works
  - [ ] View company settings: works

- [ ] **API Endpoints**
  - [ ] `GET /api/health` returns 200 ✅
  - [ ] `GET /api/customers` returns data
  - [ ] `GET /api/projects` returns data
  - [ ] `POST /api/quotes` creates quote
  - [ ] `POST /api/auth/refresh` returns new token

### Load Testing (Optional but Recommended)

- [ ] **Light Load Test**
  - [ ] Simulate 10 concurrent users
  - [ ] Simulate 100 requests/minute
  - [ ] Monitor CPU usage (should be <70%)
  - [ ] Monitor memory usage (should be <80%)
  - [ ] Monitor database connections (should be <20)
  - [ ] No errors observed

### Data Validation

- [ ] **Database State**
  - [ ] Seed data created successfully
  - [ ] All tables populated
  - [ ] Foreign key relationships intact
  - [ ] No duplicate data

- [ ] **File Storage**
  - [ ] Uploads directory exists and is writable
  - [ ] Sample file can be uploaded and downloaded
  - [ ] File permissions correct

### Monitoring in Staging

- [ ] **Monitoring Active**
  - [ ] Error tracking working (test with 404)
  - [ ] Logs being collected
  - [ ] Health checks passing
  - [ ] Alerts not firing (should be quiet)

- [ ] **Performance Baseline**
  - [ ] Document API latency baseline
  - [ ] Document resource utilization baseline
  - [ ] Document page load time baseline

### Sign-Off

- [ ] **Staging Approved**
  - [ ] All smoke tests passed
  - [ ] Team lead approval obtained
  - [ ] No critical issues found
  - [ ] Ready to proceed to production

---

## PRODUCTION DEPLOYMENT CHECKLIST (Day of deployment)

### Pre-Deployment Window

- [ ] **Final Verification**
  - [ ] Production environment verified (networking, storage, etc.)
  - [ ] Backups are current
  - [ ] Monitoring is armed and ready
  - [ ] Team is ready (on-call established)
  - [ ] Communication channels open

- [ ] **Secrets Verified**
  - [ ] Production secrets loaded in secure location
  - [ ] No secrets committed to git
  - [ ] Secrets not visible in logs

### Deployment

- [ ] **Database Migration**
  - [ ] Database backup taken **before** migration
  - [ ] Migrations executed: `npx prisma migrate deploy`
  - [ ] All migrations succeeded
  - [ ] Database is accessible
  - [ ] Seed data present (if needed)

- [ ] **Backend Deployment**
  - [ ] Docker image pulled: `docker pull backend:latest`
  - [ ] Backend container started
  - [ ] Backend logs clean (no errors in first 10 lines)
  - [ ] `GET /api/health` returns 200 ✅
  - [ ] Database connection verified (health endpoint checks DB)
  - [ ] Redis connection verified (health endpoint checks Redis)

- [ ] **Frontend Deployment**
  - [ ] Docker image pulled: `docker pull frontend:latest`
  - [ ] Frontend container started
  - [ ] Frontend accessible at https://yourdomain.com
  - [ ] Assets loading (CSS, JS, images)
  - [ ] No console errors on login page

- [ ] **Post-Deployment Tests**
  - [ ] Login works
  - [ ] Can navigate dashboard
  - [ ] Can view customers
  - [ ] Can create new customer
  - [ ] Can view projects
  - [ ] API calls succeeding (check network tab)

### Monitoring

- [ ] **Health Checks Passing**
  - [ ] Backend health: 200 ✅
  - [ ] Frontend health: 200 ✅
  - [ ] Database responding
  - [ ] Redis responding

- [ ] **Error Monitoring**
  - [ ] No critical errors in Sentry/DataDog
  - [ ] No 5xx responses
  - [ ] Error rate < 1%

- [ ] **Performance**
  - [ ] API latency within baseline (< 200ms for lists)
  - [ ] Page load times acceptable
  - [ ] No slow queries detected

### First Hour Monitoring

- [ ] **Continuous Monitoring**
  - [ ] Watch error rate (should be 0%)
  - [ ] Watch latency (should match baseline)
  - [ ] Watch disk space (should be normal)
  - [ ] Watch memory usage (should be <60%)
  - [ ] Watch CPU usage (should be <30%)

- [ ] **User Activity**
  - [ ] Internal team can login
  - [ ] Can perform basic CRM operations
  - [ ] No data corruption observed
  - [ ] No permission issues reported

### Rollback Readiness

- [ ] **Rollback Plan Ready**
  - [ ] Previous version container image available
  - [ ] Database backup available and tested
  - [ ] Rollback procedure documented
  - [ ] Team knows how to execute rollback
  - [ ] DNS/load balancer can be reverted quickly

- [ ] **Decision Criteria**
  - [ ] If error rate > 5% for 5 minutes → rollback
  - [ ] If health check failing → rollback
  - [ ] If data corruption detected → rollback
  - [ ] Otherwise → observe for 24 hours before finalizing

---

## POST-DEPLOYMENT CHECKLIST (First 24 hours)

### Immediate (First Hour)

- [ ] **System Stable**
  - [ ] No critical errors
  - [ ] No performance degradation
  - [ ] Health checks passing
  - [ ] Users able to work

- [ ] **Monitoring Active**
  - [ ] Error tracking working
  - [ ] Logs being collected
  - [ ] Alerts configured and ready
  - [ ] Dashboard showing metrics

### Extended Monitoring (First 24 Hours)

- [ ] **Collect Baseline**
  - [ ] Record typical error rate (should be <0.5%)
  - [ ] Record typical latency (p50, p95, p99)
  - [ ] Record typical resource usage
  - [ ] Record typical request volume

- [ ] **User Feedback**
  - [ ] No major issues reported
  - [ ] Performance is acceptable
  - [ ] Data looks correct
  - [ ] Workflows working as expected

- [ ] **Data Validation**
  - [ ] Historical data intact
  - [ ] No missing records
  - [ ] No duplicate records
  - [ ] Relationships intact

### After 24 Hours

- [ ] **Stabilization Confirmed**
  - [ ] 24+ hours of stable operation
  - [ ] No critical issues
  - [ ] Performance consistent
  - [ ] Ready for wide user access

- [ ] **Documentation Update**
  - [ ] Production runbook updated with real values
  - [ ] Troubleshooting guide updated with lessons learned
  - [ ] Architecture documentation updated
  - [ ] Team wiki updated with deployment details

- [ ] **Team Debrief**
  - [ ] Lessons learned documented
  - [ ] Process improvements identified
  - [ ] Team trained on any new procedures
  - [ ] Incident response plan refined

---

## ONGOING OPERATIONS CHECKLIST (Daily/Weekly)

### Daily (Every Morning)

- [ ] **Health Check**
  - [ ] All services healthy (GET /api/health → 200)
  - [ ] No critical errors in logs
  - [ ] Error rate normal (< 1%)
  - [ ] Latency normal (< 200ms for lists)

- [ ] **Backup Verification**
  - [ ] Last backup completed successfully
  - [ ] Backup size reasonable (not 0 bytes)
  - [ ] Backup restorable (test once weekly)

- [ ] **Disk Space**
  - [ ] Used space < 70%
  - [ ] Uploads directory not growing unexpectedly
  - [ ] Log files being rotated/cleaned

### Weekly

- [ ] **Full Health Audit**
  - [ ] Run smoke test suite: login, CRUD, PDF, etc.
  - [ ] Check database query performance
  - [ ] Verify backup restoration works
  - [ ] Review error logs for patterns

- [ ] **Capacity Planning**
  - [ ] Monitor growth rate of database size
  - [ ] Monitor growth rate of uploads storage
  - [ ] Verify retention policies working
  - [ ] Plan for scaling if needed

### Monthly

- [ ] **Performance Review**
  - [ ] Analyze latency trends
  - [ ] Identify slow endpoints
  - [ ] Review error patterns
  - [ ] Update baseline metrics

- [ ] **Security Review**
  - [ ] Review access logs
  - [ ] Check for security advisories
  - [ ] Update dependencies (if available)
  - [ ] Rotate secrets if needed

---

## ROLLBACK CHECKLIST (If Needed)

### Decision to Rollback

- [ ] **Criteria Met**
  - [ ] Critical error observed (e.g., data loss)
  - [ ] System unavailable (health checks failing)
  - [ ] Error rate > 10% sustained
  - [ ] Major performance degradation
  - [ ] Security issue detected

- [ ] **Authorization**
  - [ ] Team lead approval obtained
  - [ ] Business owner notified
  - [ ] Users informed of downtime

### Rollback Execution

- [ ] **Stop Current Deployment**
  - [ ] Stop frontend container: `docker stop frontend`
  - [ ] Stop backend container: `docker stop backend`
  - [ ] Verify containers stopped: `docker ps`

- [ ] **Restore Database** (If Needed)
  - [ ] Have backup file ready: `backup.sql`
  - [ ] Restore to fresh database: `psql ahso_crm < backup.sql`
  - [ ] Verify data restored: `SELECT COUNT(*) FROM customers`

- [ ] **Start Previous Version**
  - [ ] Check out previous stable commit
  - [ ] Rebuild backend image (or pull previous tag)
  - [ ] Rebuild frontend image (or pull previous tag)
  - [ ] Start containers: `docker-compose up -d`
  - [ ] Verify health: `GET /api/health` → 200

- [ ] **Verification**
  - [ ] Login works
  - [ ] Can access customer data
  - [ ] No recent data lost
  - [ ] System performance restored

- [ ] **Communication**
  - [ ] Users informed: "System restored, no data lost"
  - [ ] Incident report filed
  - [ ] Root cause analysis scheduled

---

## TROUBLESHOOTING QUICK REFERENCE

### Backend won't start

```bash
# Check logs
docker logs backend

# Common issues:
# - Database connection failed → check DATABASE_URL, postgres running
# - Migration failed → check schema.prisma, review error
# - Port in use → change PORT env var or kill process
# - Memory issues → increase container memory limit
```

### Frontend won't load

```bash
# Check logs
docker logs frontend

# Common issues:
# - Backend unreachable → check NEXT_PUBLIC_API_URL
# - 404 on assets → check Next.js build succeeded
# - DNS issues → verify frontend domain resolves
# - Certificate issues → check TLS/SSL setup
```

### Database connection issues

```bash
# Test PostgreSQL
psql postgresql://ahso:password@localhost:5432/ahso_crm -c "SELECT 1"

# Check for:
# - Wrong password → verify POSTGRES_PASSWORD
# - Port closed → check firewall rules
# - Database doesn't exist → create it
# - Disk full → check available space
```

### High error rate

```bash
# Check application logs
docker logs backend | grep -i error

# Check monitoring
# - Error tracking (Sentry): identify error patterns
# - Database logs: slow queries or connection errors
# - Resource usage: CPU, memory, disk space exhaustion

# Common causes:
# - Database queries too slow → check indexes
# - Memory leak → restart container
# - Disk full → clean old logs
# - Resource contention → scale up or reduce load
```

### Slow API responses

```bash
# Identify slow endpoints
# Check monitoring dashboard or logs for latency metrics

# Check database
# - Identify slow queries: enable query logging
# - Run EXPLAIN ANALYZE on slow queries
# - Add missing indexes if needed

# Check resources
# - CPU usage high? → scale up or optimize code
# - Memory usage high? → check for memory leaks
# - Disk I/O slow? → check disk performance
```

---

## Sign-Off

**Deployment Checklist Complete:** ☐
**Date:** ________________
**Deployed By:** ________________
**Approved By:** ________________
**Team Lead:** ________________

---

**For questions, refer to:**
- Full Assessment: `/docs/DEPLOYMENT_READINESS_ASSESSMENT.md`
- Production Runbook: `/docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Architecture: `/docs/PROJECT_STRUCTURE.md`
- Troubleshooting: `/README.md`
