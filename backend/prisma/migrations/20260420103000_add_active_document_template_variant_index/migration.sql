CREATE UNIQUE INDEX "DocumentTemplateVariant_active_type_unique"
ON "DocumentTemplateVariant"("type")
WHERE "isActive" = true;
