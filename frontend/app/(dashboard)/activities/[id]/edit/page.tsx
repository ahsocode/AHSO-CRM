import { ActivityFormScreen } from '../../_components/activity-form-screen';

export const metadata = {
  title: 'Chỉnh sửa hoạt động',
  description: 'Chỉnh sửa hoạt động',
};

export default function EditActivityPage({ params }: { params: { id: string } }) {
  return <ActivityFormScreen id={params.id} />;
}
