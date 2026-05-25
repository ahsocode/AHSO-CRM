import { Module } from "@nestjs/common";
import { CustomFieldsModule } from "../custom-fields/custom-fields.module";
import { DocumentsModule } from "../documents/documents.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [DomainEventsModule, CustomFieldsModule, DocumentsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService]
})
export class ProjectsModule {}
