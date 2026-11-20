import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireScope } from "../api-tokens/require-scope.decorator";
import { RequireAnyPermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CreateReceiptFromInvoiceDto,
  DiscardPendingLineDto,
  MatchLineDto,
  PendingLineFilterDto,
  PendingReviewFilterDto,
  ResolvePendingLineDto,
  SaveAliasDto,
  createReceiptFromInvoiceSchema,
  discardPendingLineSchema,
  matchLineSchema,
  pendingLineFilterSchema,
  pendingReviewFilterSchema,
  resolvePendingLineSchema,
  saveAliasSchema
} from "./dto/invoice-intake.dto";
import { InvoiceIntakeService } from "./invoice-intake.service";
import { MaterialMatchingService } from "./material-matching.service";
import { PendingLinesService } from "./pending-lines.service";

// Machine tokens: only these routes carry @RequireScope (default-deny elsewhere). Machine permissions equal their scopes.
@ApiTags("invoice-intake")
@Controller("invoice-intake")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoiceIntakeController {
  constructor(
    private readonly intake: InvoiceIntakeService,
    private readonly matching: MaterialMatchingService,
    private readonly pendingLines: PendingLinesService
  ) {}

  @RequireScope("inventory.read")
  @RequireAnyPermissions("inventory.view", "inventory.read")
  @ApiOperation({ summary: "POST /api/invoice-intake/match-line — exact alias match + fuzzy suggestions" })
  @Post("match-line")
  matchLine(@Body(new ZodValidationPipe(matchLineSchema)) dto: MatchLineDto) {
    return this.matching.matchLine(dto);
  }

  @RequireScope("inventory.alias_write")
  @RequireAnyPermissions("inventory.edit", "inventory.alias_write")
  @ApiOperation({ summary: "POST /api/invoice-intake/aliases — save supplier item -> material alias" })
  @Post("aliases")
  saveAlias(@Body(new ZodValidationPipe(saveAliasSchema)) dto: SaveAliasDto, @CurrentUser() user: JwtUser) {
    return this.matching.saveAlias(dto, user);
  }

  @RequireScope("inventory.read")
  @RequireAnyPermissions("inventory.view", "inventory.read")
  @ApiOperation({ summary: "GET /api/invoice-intake/pending-lines" })
  @Get("pending-lines")
  listPending(
    @Query(new ZodValidationPipe(pendingLineFilterSchema, "query")) filters: PendingLineFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.pendingLines.list(filters, user);
  }

  @RequireScope("inventory.receipt_draft")
  @RequireAnyPermissions("inventory.edit", "inventory.receipt_draft")
  @ApiOperation({ summary: "POST /api/invoice-intake/pending-lines/:id/resolve" })
  @Post("pending-lines/:id/resolve")
  resolve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(resolvePendingLineSchema)) dto: ResolvePendingLineDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.pendingLines.resolve(id, dto, user);
  }

  @RequireScope("inventory.receipt_draft")
  @RequireAnyPermissions("inventory.edit", "inventory.receipt_draft")
  @ApiOperation({ summary: "POST /api/invoice-intake/pending-lines/:id/discard" })
  @Post("pending-lines/:id/discard")
  discard(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(discardPendingLineSchema)) dto: DiscardPendingLineDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.pendingLines.discard(id, dto, user);
  }

  // Declared before any ":id" style route so "pending-review" is never captured as an id.
  @RequireScope("inventory.read")
  @RequireAnyPermissions("inventory.view", "inventory.read")
  @ApiOperation({ summary: "GET /api/invoice-intake/receipts/pending-review" })
  @Get("receipts/pending-review")
  pendingReview(
    @Query(new ZodValidationPipe(pendingReviewFilterSchema, "query")) filters: PendingReviewFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.intake.listPendingReview(filters, user);
  }

  @RequireScope("inventory.receipt_draft")
  @RequireAnyPermissions("inventory.create", "inventory.receipt_draft")
  @ApiOperation({ summary: "POST /api/invoice-intake/receipts — create DRAFT receipt from an invoice (idempotent)" })
  @Post("receipts")
  async createReceipt(
    @Body(new ZodValidationPipe(createReceiptFromInvoiceSchema)) dto: CreateReceiptFromInvoiceDto,
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.intake.createFromInvoice(dto, user);
    // Existing / skipped / no-op submissions are not "created".
    if (!result.created) res.status(200);
    return result;
  }
}
