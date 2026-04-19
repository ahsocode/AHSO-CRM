-- CreateTable UserRole
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable Permission
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable Setting
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable Logo
CREATE TABLE "Logo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Logo_pkey" PRIMARY KEY ("id")
);

-- CreateTable _PermissionToUserRole (junction table for many-to-many)
CREATE TABLE "_PermissionToUserRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Add roleId column to User table (nullable temporarily)
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- Insert system roles
INSERT INTO "UserRole" ("id", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES
('role_admin', 'ADMIN', 'Administrator with full access', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('role_manager', 'MANAGER', 'Manager with team and project access', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('role_staff', 'STAFF', 'Staff with limited access', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Migrate existing user roles from enum to foreign keys
UPDATE "User" SET "roleId" = 'role_admin' WHERE "role" = 'ADMIN';
UPDATE "User" SET "roleId" = 'role_manager' WHERE "role" = 'MANAGER';
UPDATE "User" SET "roleId" = 'role_staff' WHERE "role" = 'STAFF';

-- Set roleId to default (STAFF) for any NULL values (shouldn't happen but just in case)
UPDATE "User" SET "roleId" = 'role_staff' WHERE "roleId" IS NULL;

-- Make roleId NOT NULL
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- Drop the old role enum column
ALTER TABLE "User" DROP COLUMN "role";

-- Create indexes
CREATE UNIQUE INDEX "UserRole_name_key" ON "UserRole"("name");
CREATE INDEX "UserRole_name_idx" ON "UserRole"("name");
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");
CREATE INDEX "Permission_resource_idx" ON "Permission"("resource");
CREATE INDEX "Logo_uploadedAt_idx" ON "Logo"("uploadedAt");

-- Create unique index on Setting key
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- Create foreign key from User to UserRole
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "UserRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create unique constraints for junction table
CREATE UNIQUE INDEX "_PermissionToUserRole_AB_unique" ON "_PermissionToUserRole"("A", "B");
CREATE INDEX "_PermissionToUserRole_B_index" ON "_PermissionToUserRole"("B");

-- Create the junction table foreign keys
ALTER TABLE "_PermissionToUserRole" ADD CONSTRAINT "_PermissionToUserRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PermissionToUserRole" ADD CONSTRAINT "_PermissionToUserRole_B_fkey" FOREIGN KEY ("B") REFERENCES "UserRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default permissions (all resources x all actions)
INSERT INTO "Permission" ("id", "resource", "action", "createdAt") VALUES
-- Activities
('perm_activities_view', 'activities', 'view', CURRENT_TIMESTAMP),
('perm_activities_create', 'activities', 'create', CURRENT_TIMESTAMP),
('perm_activities_edit', 'activities', 'edit', CURRENT_TIMESTAMP),
('perm_activities_delete', 'activities', 'delete', CURRENT_TIMESTAMP),
-- Customers
('perm_customers_view', 'customers', 'view', CURRENT_TIMESTAMP),
('perm_customers_create', 'customers', 'create', CURRENT_TIMESTAMP),
('perm_customers_edit', 'customers', 'edit', CURRENT_TIMESTAMP),
('perm_customers_delete', 'customers', 'delete', CURRENT_TIMESTAMP),
-- Projects
('perm_projects_view', 'projects', 'view', CURRENT_TIMESTAMP),
('perm_projects_create', 'projects', 'create', CURRENT_TIMESTAMP),
('perm_projects_edit', 'projects', 'edit', CURRENT_TIMESTAMP),
('perm_projects_delete', 'projects', 'delete', CURRENT_TIMESTAMP),
-- Quotes
('perm_quotes_view', 'quotes', 'view', CURRENT_TIMESTAMP),
('perm_quotes_create', 'quotes', 'create', CURRENT_TIMESTAMP),
('perm_quotes_edit', 'quotes', 'edit', CURRENT_TIMESTAMP),
('perm_quotes_delete', 'quotes', 'delete', CURRENT_TIMESTAMP),
-- Contracts
('perm_contracts_view', 'contracts', 'view', CURRENT_TIMESTAMP),
('perm_contracts_create', 'contracts', 'create', CURRENT_TIMESTAMP),
('perm_contracts_edit', 'contracts', 'edit', CURRENT_TIMESTAMP),
('perm_contracts_delete', 'contracts', 'delete', CURRENT_TIMESTAMP),
-- Payments
('perm_payments_view', 'payments', 'view', CURRENT_TIMESTAMP),
('perm_payments_create', 'payments', 'create', CURRENT_TIMESTAMP),
('perm_payments_edit', 'payments', 'edit', CURRENT_TIMESTAMP),
('perm_payments_delete', 'payments', 'delete', CURRENT_TIMESTAMP),
-- Settings
('perm_settings_view', 'settings', 'view', CURRENT_TIMESTAMP),
('perm_settings_edit', 'settings', 'edit', CURRENT_TIMESTAMP),
-- Users
('perm_users_view', 'users', 'view', CURRENT_TIMESTAMP),
('perm_users_create', 'users', 'create', CURRENT_TIMESTAMP),
('perm_users_edit', 'users', 'edit', CURRENT_TIMESTAMP),
('perm_users_delete', 'users', 'delete', CURRENT_TIMESTAMP),
-- Roles
('perm_roles_view', 'roles', 'view', CURRENT_TIMESTAMP),
('perm_roles_create', 'roles', 'create', CURRENT_TIMESTAMP),
('perm_roles_edit', 'roles', 'edit', CURRENT_TIMESTAMP),
('perm_roles_delete', 'roles', 'delete', CURRENT_TIMESTAMP);

-- Assign all permissions to ADMIN role
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT "id", 'role_admin' FROM "Permission";

-- Assign specific permissions to MANAGER role (everything except roles/users management)
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT "id", 'role_manager' FROM "Permission"
WHERE "resource" IN ('activities', 'customers', 'projects', 'quotes', 'contracts', 'payments', 'settings')
  AND "action" IN ('view', 'create', 'edit');

-- Assign view-only permissions to STAFF role
INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT "id", 'role_staff' FROM "Permission"
WHERE "action" = 'view'
   OR ("resource" = 'activities' AND "action" IN ('create', 'edit'));
