import { SurveyDetailClient } from "../_components/survey-detail-client";

interface SurveyDetailPageProps {
  params: { id: string };
}

export default function SurveyDetailPage({ params }: SurveyDetailPageProps) {
  return <SurveyDetailClient id={params.id} />;
}
