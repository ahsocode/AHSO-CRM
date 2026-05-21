import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ActivitiesModule } from "../activities/activities.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { AgentActionRegistry } from "./actions/action-registry";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";

@Module({
  imports: [AiModule, ActivitiesModule, DomainEventsModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentActionRegistry],
  exports: [AgentsService]
})
export class AgentsModule {}
