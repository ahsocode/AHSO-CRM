import { Global, Module } from "@nestjs/common";
import { PermissionsGuard } from "./guards/permissions.guard";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService, PermissionsGuard],
  exports: [PrismaService, PermissionsGuard]
})
export class CommonModule {}
