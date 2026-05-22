import { SurveyFormScreen } from "../../_components/survey-form-screen";

interface EditSurveyPageProps {
  params: { id: string };
}

export default function EditSurveyPage({ params }: EditSurveyPageProps) {
  return <SurveyFormScreen id={params.id} />;
}
