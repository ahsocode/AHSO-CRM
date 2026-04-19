import { Module } from "@nestjs/common";
import { CustomFieldsModule } from "../custom-fields/custom-fields.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [DomainEventsModule, CustomFieldsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService]
})
export class ProjectsModule {}
