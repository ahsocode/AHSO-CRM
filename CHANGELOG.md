# AHSO CRM - Changelog

All notable changes to this project are documented in this file.

**Format**: Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.0.0] - 2026-04-19

### 🎉 Initial Release - Production Ready

Complete B2B Sales Management System with 95% feature implementation.

#### ✨ Features Added

**Core Modules (17/17 Complete)**
- ✅ Authentication (JWT + refresh tokens)
- ✅ User Management (create, edit, role assignment)
- ✅ Customers (CRUD, contacts, soft delete)
- ✅ Projects (Kanban with 7 stages, drag-drop)
- ✅ Quotes (PDF generation, versioning, status workflow)
- ✅ Contracts (milestones, payments, attachments, PDF)
- ✅ Activities (7 types, soft delete, timeline)
- ✅ Calendar (week/month view, drag-to-reschedule)
- ✅ Dashboard (KPI cards, revenue chart, pipeline, tasks)
- ✅ Reports (revenue trends, status breakdown, top customers)
- ✅ Admin Panel (company settings, policies, RBAC)
- ✅ Permissions (granular resource-action based)
- ✅ Roles (system + custom roles)
- ✅ Settings (key-value config store)
- ✅ Upload (file storage, logo management)
- ✅ CSV Import (bulk customer/project import)
- ✅ PDF Generation (Quotes + Contracts)

**Frontend Pages (20/20 Complete)**
- ✅ Authentication (login, forgot password, reset password)
- ✅ Dashboard (main KPI view)
- ✅ Customers (list, detail, new, edit)
- ✅ Projects (kanban, list, detail, new, edit)
- ✅ Quotes (list, detail, new, edit, preview)
- ✅ Contracts (list, detail, new, edit, acceptance preview)
- ✅ Activities (list, detail, new, edit)
- ✅ Calendar (week/month views)
- ✅ Reports (analytics)
- ✅ Users (management)
- ✅ Admin (company info, policies, roles, permissions)

**Database**
- ✅ 14 models with proper relations
- ✅ Soft delete patterns
- ✅ 3 migrations (initial, RBAC, admin features)
- ✅ Indexes on frequently queried fields
- ✅ Decimal precision for currency

**Infrastructure**
- ✅ Docker Compose setup
- ✅ Environment variable configuration
- ✅ Database seeding with test data
- ✅ API Swagger documentation
- ✅ Unit tests for core services

#### 🔒 Security Features

- JWT authentication with refresh token rotation
- bcrypt password hashing
- Role-based access control (RBAC)
- Granular permission gates on all endpoints
- CORS policy enforcement
- SQL injection prevention
- XSS protection
- CSRF protection

#### 📊 Business Features

- Complete sales pipeline management
- Activity tracking (7 types)
- PDF generation for quotes and contracts
- File attachment management
- Soft delete with recovery
- Customer relationship tracking
- Payment logging
- Milestone management
- Revenue analytics
- Pipeline forecasting

---

## Development Timeline

### Week 1: Foundation & Authentication
- Project setup (Next.js, NestJS, Prisma)
- Database schema design (14 models)
- Authentication system (JWT + refresh tokens)
- Basic CRUD scaffolding
- Docker Compose configuration

**Status**: ✅ Complete

### Week 2: Customers Module
- Customer CRUD operations
- Contact management
- Customer filtering and search
- Dashboard KPI aggregation
- Customer detail page with timeline

**Status**: ✅ Complete

### Week 3: Projects Module
- Project CRUD operations
- Kanban board with 7 stages
- Drag-drop stage transitions
- Project filtering and search
- Status history tracking

**Status**: ✅ Complete

### Week 4: Quotes Module
- Quote CRUD operations
- Line item management
- Puppeteer PDF generation
- Quote versioning
- Status workflow (DRAFT → SENT → ACCEPTED)
- Quote preview page

**Status**: ✅ Complete

### Week 5: Contracts Module
- Contract CRUD operations
- Milestone tracking and dates
- Payment logging
- File attachment upload
- Acceptance PDF generation
- Contract acceptance workflow

**Status**: ✅ Complete

### Week 6: Admin Panel & RBAC
- Role-based access control system
- Permission management (resource-action pairs)
- Admin panel for settings
- Company information management
- Policy editor (payment terms, warranty, SLA)
- User management and role assignment
- Logo upload functionality
- Reports module (revenue analytics, status breakdown)
- Activities module (7 activity types)
- Calendar module (week/month views)

**Status**: ✅ Complete

### Week 6+ Polish & Optimization
- Calendar UX improvements (week/month auto-scaling)
- Date input validation and persistence
- Toast notifications for warnings
- Performance optimization (debouncing, caching)
- Error handling improvements
- Security hardening

**Status**: ✅ Complete

---

## Recent Changes

### [1.0.0-rc.6] - 2026-04-19 - Calendar Polish
**Fixed**
- Calendar date range inputs now persist correctly
- Toast notifications replace inline warnings
- Removed redundant UI text for date jumping
- Calendar properly scales between week/month views

**Changed**
- Date inputs now handle both week and month views
- Warning messages display as non-intrusive toasts
- Search becomes dual-purpose (text + date jumping)

### [1.0.0-rc.5] - 2026-04-17 - Calendar Smart Modes
**Added**
- Week view (7 days max, auto-disables)
- Month view (auto-scales 1-3 columns)
- Auto-clamp to 92 days max
- Drag-to-reschedule activities
- Toast notifications for limit warnings

**Changed**
- Calendar filters refactored into single card
- View mode buttons now display-only
- Date range inputs are master control

### [1.0.0-rc.4] - 2026-04-15 - Performance Optimization
**Fixed**
- ThrottlerException: Too Many Requests resolved
- Reduced API call frequency with debouncing
- Implemented longer staleTime for queries
- Disabled auto-refetch on tab switch

**Changed**
- Search debounce: 500ms
- Query cache: 10 minute staleTime
- Disabled: refetchOnWindowFocus, refetchOnReconnect

### [1.0.0-rc.3] - 2026-04-10 - Reports & Calendar
**Added**
- Reports module (revenue trends, status breakdown, top customers)
- Calendar module (week view, month view, filters)
- Activity soft delete functionality
- CSV import for bulk operations

**Fixed**
- Dashboard KPI calculations
- Revenue chart formatting
- Pipeline count accuracy

### [1.0.0-rc.2] - 2026-04-08 - Admin Panel & RBAC
**Added**
- Admin panel with routes
- Role management (system + custom roles)
- Permission management (resource-action based)
- Company settings editor
- Policy management (payment terms, warranty, SLA)
- Logo upload functionality
- User management page

**Changed**
- Auth system now uses RBAC
- All endpoints protected by permission gates

### [1.0.0-rc.1] - 2026-03-20 - Complete Contracts Module
**Added**
- Contracts CRUD operations
- Milestone tracking with dates
- Payment logging with amounts
- File attachment upload
- Acceptance PDF generation
- Contract acceptance workflow

**Fixed**
- Contract status transitions
- Milestone date validation

### [1.0.0-beta.4] - 2026-03-15 - Quotes with PDF
**Added**
- Puppeteer PDF generation for quotes
- Quote versioning and duplication
- Quote preview page
- Line item management

**Changed**
- Quote status workflow enforcement
- API response format standardization

### [1.0.0-beta.3] - 2026-03-10 - Projects Kanban
**Added**
- Project CRUD operations
- Kanban board with 7 stages
- Drag-drop stage transitions
- Project filtering and search
- Project detail page

**Fixed**
- Stage transition validation
- Kanban persistence

### [1.0.0-beta.2] - 2026-03-05 - Customers Module
**Added**
- Customer CRUD operations
- Contact management within customers
- Customer filtering and search
- Customer detail page
- Customer statistics

**Fixed**
- Tax ID uniqueness validation

### [1.0.0-beta.1] - 2026-02-28 - Foundation
**Added**
- Project setup (Next.js, NestJS, Prisma)
- Database schema (14 models)
- Authentication (JWT + refresh tokens)
- Basic CRUD scaffolding
- Dashboard KPI aggregation
- Docker Compose setup

**Fixed**
- Initial database migrations
- CORS configuration
- Environment variables

---

## Known Limitations

### Not Implemented (Future Enhancements)
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] E2E Tests (Playwright/Cypress)
- [ ] Mobile App (React Native)
- [ ] Advanced BI Dashboard
- [ ] AI Features (Claude API)
- [ ] Email Service Integration
- [ ] SMS Notifications
- [ ] Webhook System
- [ ] Multi-tenant Support
- [ ] SSO/OAuth Integration

### Performance Notes
- PDF generation (Puppeteer) may take 2-3 seconds per document
- Large file uploads (>50MB) may timeout
- Real-time sync not implemented (page refresh required)
- Calendar scaling at 1-3 months recommended max

### Browser Support
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ❌ IE 11 (not supported)

---

## Deployment Checklist

- [x] Database migrations tested
- [x] Docker images build successfully
- [x] Environment variables configured
- [x] API documentation generated (Swagger)
- [x] Unit tests passing
- [x] Security headers configured
- [x] CORS policy enforced
- [x] Error handling implemented
- [x] Logging configured
- [x] Backup strategy planned

---

## Upgrade Guide

### From Beta to 1.0
1. Run latest database migrations
2. Update environment variables
3. Clear browser cache
4. Re-authenticate all users
5. Test all workflows

### Dependencies Updated
- Next.js: 14.2.35
- NestJS: 10.2.10
- Prisma: 5.8.0
- React: 18.2.0
- TypeScript: 5.3.3

---

## Credits

**Development Team**: AHSO Vietnam  
**AI Assistance**: Claude 3.5 Sonnet  
**Open Source**: Next.js, NestJS, Prisma, Tailwind CSS, shadcn/ui

---

## License

Proprietary - AHSO Vietnam

---

## Support

- 📖 **Documentation**: [docs/](docs/)
- 🐛 **Bug Reports**: Create an issue
- 💬 **Questions**: Check existing issues
- 📧 **Email**: support@ahso.vn

---

**Last Updated**: April 19, 2026  
**Next Version**: 1.1.0 (ETA: Q3 2026)
