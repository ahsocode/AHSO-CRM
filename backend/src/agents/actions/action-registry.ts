import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { createActivitySchema } from "../../activities/dto/create-activity.dto";
import { ActivitiesService } from "../../activities/activities.service";
import { JwtUser } from "../../auth/auth.types";

export type AgentActionType = "CREATE_ACTIVITY";
export type AgentActionRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AgentActionEntityRef {
  type: string;
  id: string;
  label?: string;
}

export interface AgentActionDefinition {
  type: AgentActionType;
  schema: z.ZodTypeAny;
  requiredPermission: string;
  riskLevel: AgentActionRiskLevel;
  targetEntityType: string;
  executor: (payload: unknown, user: JwtUser) => Promise<AgentActionEntityRef>;
  dryRunSummary: (payload: unknown) => string;
}

@Injectable()
export class AgentActionRegistry {
  constructor(private readonly activitiesService: ActivitiesService) {}

  getDefinition(actionType: string): AgentActionDefinition | null {
    if (actionType !== "CREATE_ACTIVITY") {
      return null;
    }

    return this.createActivityDefinition();
  }

  private createActivityDefinition(): AgentActionDefinition {
    return {
      type: "CREATE_ACTIVITY",
      schema: createActivitySchema,
      requiredPermission: "activities.create",
      riskLevel: "LOW",
      targetEntityType: "activity",
      executor: async (payload, user) => {
        const parsedPayload = createActivitySchema.parse(payload);
        const activity = await this.activitiesService.create(parsedPayload, user);
        return {
          type: "activity",
          id: activity.id,
          label: activity.title
        };
      },
      dryRunSummary: (payload) => {
        const parsedPayload = createActivitySchema.safeParse(payload);
        if (!parsedPayload.success) {
          return "Tạo hoạt động CRM";
        }
        const schedule = parsedPayload.data.scheduledAt
          ? ` vào ${parsedPayload.data.scheduledAt.toLocaleString("vi-VN")}`
          : "";
        return `Tạo hoạt động "${parsedPayload.data.title}"${schedule}`;
      }
    };
  }
}
