import { Module } from "@nestjs/common";
import { PolicyItemsController } from "./policy-items.controller";
import { PolicyItemsService } from "./policy-items.service";

@Module({
  controllers: [PolicyItemsController],
  providers: [PolicyItemsService]
})
export class PolicyItemsModule {}
