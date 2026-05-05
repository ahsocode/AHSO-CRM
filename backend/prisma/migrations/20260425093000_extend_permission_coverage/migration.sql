-- Add permissions needed by secondary CRM surfaces without changing Prisma models.
WITH new_permissions ("id", "resource", "action") AS (
  VALUES
    ('perm_reports_view', 'reports', 'view'),
    ('perm_reports_create', 'reports', 'create'),
    ('perm_reports_edit', 'reports', 'edit'),
    ('perm_reports_delete', 'reports', 'delete'),
    ('perm_documents_view', 'documents', 'view'),
    ('perm_documents_create', 'documents', 'create'),
    ('perm_documents_edit', 'documents', 'edit'),
    ('perm_documents_delete', 'documents', 'delete'),
    ('perm_surveys_view', 'surveys', 'view'),
    ('perm_surveys_create', 'surveys', 'create'),
    ('perm_surveys_edit', 'surveys', 'edit'),
    ('perm_surveys_delete', 'surveys', 'delete'),
    ('perm_notifications_view', 'notifications', 'view'),
    ('perm_notifications_edit', 'notifications', 'edit')
)
INSERT INTO "Permission" ("id", "resource", "action", "createdAt")
SELECT "id", "resource", "action", CURRENT_TIMESTAMP
FROM new_permissions
ON CONFLICT ("resource", "action") DO NOTHING;

-- ADMIN receives every newly introduced permission.
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT "id", 'role_admin'
FROM "Permission"
WHERE "resource" IN ('reports', 'documents', 'surveys', 'notifications')
ON CONFLICT ("A", "B") DO NOTHING;

-- MANAGER can operate reports/documents/surveys, and manage own notification state.
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT "id", 'role_manager'
FROM "Permission"
WHERE (
    "resource" IN ('reports', 'documents', 'surveys')
    AND "action" IN ('view', 'create', 'edit')
  )
  OR (
    "resource" = 'notifications'
    AND "action" IN ('view', 'edit')
  )
ON CONFLICT ("A", "B") DO NOTHING;

-- STAFF keeps read access to reporting/documents, can contribute survey knowledge,
-- and can update notification read state.
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT "id", 'role_staff'
FROM "Permission"
WHERE (
    "resource" = 'reports'
    AND "action" = 'view'
  )
  OR (
    "resource" = 'documents'
    AND "action" = 'view'
  )
  OR (
    "resource" = 'surveys'
    AND "action" IN ('view', 'create', 'edit')
  )
  OR (
    "resource" = 'notifications'
    AND "action" IN ('view', 'edit')
  )
ON CONFLICT ("A", "B") DO NOTHING;
