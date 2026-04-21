import { Body, Controller, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  AddSurveyNoteDto,
  CreateSurveyDto,
  UpdateSurveyDto,
  UploadSurveyMediaDto,
  addSurveyNoteSchema,
  createSurveySchema,
  updateSurveySchema,
  uploadSurveyMediaSchema
} from "./dto/survey.dto";
import { SurveysService } from "./surveys.service";

@Controller("surveys")
@UseGuards(JwtAuthGuard)
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createSurveySchema)) dto: CreateSurveyDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSurveySchema)) dto: UpdateSurveyDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.update(id, dto, user);
  }

  @Post(":id/media")
  @UseInterceptors(FileInterceptor("file"))
  addMedia(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(uploadSurveyMediaSchema)) dto: UploadSurveyMediaDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.addMedia(id, file, dto, user);
  }

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

  @Post(":id/notes")
  addNote(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addSurveyNoteSchema)) dto: AddSurveyNoteDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.surveysService.addNote(id, dto, user);
  }
}
