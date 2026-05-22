import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  AddSurveyNoteDto,
  CreateSurveyDto,
  SurveyListFilterDto,
  UpdateSurveyDto,
  UploadSurveyMediaDto,
  addSurveyNoteSchema,
  createSurveySchema,
  surveyListFilterSchema,
  updateSurveySchema,
  uploadSurveyMediaSchema
} from "./dto/survey.dto";
import { SurveysService } from "./surveys.service";

const FILE_UPLOAD_OPTIONS = { limits: { fileSize: 10 * 1024 * 1024 } };

@ApiTags("surveys")
@Controller("surveys")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @RequirePermissions("surveys.view")
  @ApiOperation({ summary: "GET /api/surveys" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(surveyListFilterSchema)) filters: SurveyListFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.findAll(filters, user);
  }

  @RequirePermissions("surveys.view")
  @ApiOperation({ summary: "GET /api/surveys/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.surveysService.findOne(id, user);
  }

  @RequirePermissions("surveys.create")
  @ApiOperation({ summary: "POST /api/surveys" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createSurveySchema)) dto: CreateSurveyDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.create(dto, user);
  }

  @RequirePermissions("surveys.edit")
  @ApiOperation({ summary: "PATCH /api/surveys/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSurveySchema)) dto: UpdateSurveyDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.update(id, dto, user);
  }

  @RequirePermissions("surveys.edit")
  @ApiOperation({ summary: "POST /api/surveys/:id/media" })
  @Post(":id/media")
  @UseInterceptors(FileInterceptor("file", FILE_UPLOAD_OPTIONS))
  addMedia(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(uploadSurveyMediaSchema)) dto: UploadSurveyMediaDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.addMedia(id, file, dto, user);
  }

  @RequirePermissions("surveys.view")
  @ApiOperation({ summary: "GET /api/surveys/media/:mediaId/file" })
  @Get("media/:mediaId/file")
  async downloadMedia(
    @Param("mediaId") mediaId: string,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const { buffer, filename, mimeType } = await this.surveysService.downloadMedia(mediaId, user);
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    response.send(buffer);
  }

  @RequirePermissions("surveys.edit")
  @ApiOperation({ summary: "POST /api/surveys/:id/notes" })
  @Post(":id/notes")
  addNote(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addSurveyNoteSchema)) dto: AddSurveyNoteDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.addNote(id, dto, user);
  }
}
