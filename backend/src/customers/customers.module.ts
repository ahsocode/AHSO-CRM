import { Module } from "@nestjs/common";
import { CustomFieldsModule } from "../custom-fields/custom-fields.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [DomainEventsModule, CustomFieldsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService]
})
export class CustomersModule {}
