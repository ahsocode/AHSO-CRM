"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ClipboardList, Edit, MapPin, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSurvey } from "@/hooks/use-surveys";
import { formatDate } from "@/lib/format";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { SurveyMediaGallery } from "./survey-media-gallery";
import { SurveyNotesSection } from "./survey-notes-section";

interface SurveyDetailClientProps {
  id: string;
}

export function SurveyDetailClient({ id }: SurveyDetailClientProps) {
  const router = useRouter();
  const { data: survey, isLoading } = useSurvey(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-8 w-48" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-secondary">Không tìm thấy khảo sát</p>
        <Link href="/surveys">
          <Button className="mt-4 bg-primary">Quay lại danh sách</Button>
        </Link>
      </div>
    );
  }

  const mediaCount = survey.media.length;
  const notesCount = survey.notes.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="text-primary-light hover:bg-primary-bg">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>
        <Link href={`/surveys/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Chỉnh sửa
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">{survey.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
          {survey.surveyedAt && <span>{formatDate(survey.surveyedAt)}</span>}
          {survey.customer && (
            <Link href={`/customers/${survey.customer.id}`} className="hover:text-primary-light">
              {survey.customer.name}
            </Link>
          )}
          {survey.project && (
            <Link href={`/projects/${survey.project.id}`} className="hover:text-primary-light">
              {survey.project.code}
            </Link>
          )}
          {survey.createdBy && (
            <span className="text-text-muted">bởi {survey.createdBy.name}</span>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="media">
            Media{mediaCount > 0 ? ` (${mediaCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notes">
            Ghi chú{notesCount > 0 ? ` (${notesCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          {!survey.location && !survey.customerParticipants && !survey.objectives && !survey.summary && !survey.nextStep ? (
            <p className="py-8 text-center text-sm text-text-muted">Chưa có thông tin chi tiết</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {survey.location && (
                  <InfoBlock icon={<MapPin className="h-4 w-4" />} label="Địa điểm">
                    {survey.location}
                  </InfoBlock>
                )}
                {survey.customerParticipants && (
                  <InfoBlock icon={<Users className="h-4 w-4" />} label="Người tham dự">
                    {survey.customerParticipants}
                  </InfoBlock>
                )}
              </div>
              {survey.objectives && (
                <InfoBlock icon={<Target className="h-4 w-4" />} label="Mục tiêu">
                  {survey.objectives}
                </InfoBlock>
              )}
              {survey.summary && (
                <InfoBlock icon={<ClipboardList className="h-4 w-4" />} label="Tóm tắt kết quả">
                  {survey.summary}
                </InfoBlock>
              )}
              {survey.nextStep && (
                <InfoBlock icon={<ArrowRight className="h-4 w-4" />} label="Bước tiếp theo">
                  {survey.nextStep}
                </InfoBlock>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="media" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <SurveyMediaGallery
                surveyId={survey.id}
                projectId={survey.projectId}
                media={survey.media}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <SurveyNotesSection
                surveyId={survey.id}
                projectId={survey.projectId}
                notes={survey.notes}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-bg-subtle p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {icon}
        {label}
      </div>
      <p className="whitespace-pre-wrap text-sm text-text-primary">{children}</p>
    </div>
  );
}
