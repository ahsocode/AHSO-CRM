import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ContractsPdfService } from "./contracts-pdf.service";
import { ContractFilterDto, contractFilterSchema } from "./dto/contract-filter.dto";
import { CreateContractDto, createContractSchema } from "./dto/create-contract.dto";
import { CreateMilestoneDto, createMilestoneSchema } from "./dto/create-milestone.dto";
import { CreatePaymentDto, createPaymentSchema } from "./dto/create-payment.dto";
import { UpdateContractDto, updateContractSchema } from "./dto/update-contract.dto";
import { UpdateMilestoneDto, updateMilestoneSchema } from "./dto/update-milestone.dto";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly contractsPdfService: ContractsPdfService
  ) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(contractFilterSchema, "query")) filters: ContractFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contractsService.findAll(filters, user);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createContractSchema)) dto: CreateContractDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contractsService.create(dto, user);
  }

  @Get(":id/acceptance-pdf")
  async downloadAcceptancePdf(
    @Param("id") id: string,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const pdf = await this.contractsPdfService.generateAcceptancePdf(id, user);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${pdf.filename}"`);
    response.send(pdf.buffer);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.contractsService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContractSchema)) dto: UpdateContractDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contractsService.update(id, dto, user);
  }

  @Post(":id/milestones")
  createMilestone(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createMilestoneSchema)) dto: CreateMilestoneDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contractsService.createMilestone(id, dto, user);
  }

  @Patch("milestones/:id")
  updateMilestone(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateMilestoneSchema)) dto: UpdateMilestoneDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contractsService.updateMilestone(id, dto, user);
  }

  @Post(":id/payments")
  createPayment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) dto: CreatePaymentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contractsService.createPayment(id, dto, user);
  }
}
