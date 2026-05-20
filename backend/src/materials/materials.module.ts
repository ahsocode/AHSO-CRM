import { Module } from "@nestjs/common";
import { MaterialCategoriesController } from "./material-categories.controller";
import { MaterialCategoriesService } from "./material-categories.service";
import { MaterialsController } from "./materials.controller";
import { MaterialsService } from "./materials.service";

@Module({
  controllers: [MaterialsController, MaterialCategoriesController],
  providers: [MaterialsService, MaterialCategoriesService],
})
export class MaterialsModule {}
