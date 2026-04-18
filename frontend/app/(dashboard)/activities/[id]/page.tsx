import { ActivityDetailClient } from '../_components/activity-detail-client';

export const metadata = {
  title: 'Chi tiết hoạt động',
  description: 'Xem chi tiết hoạt động',
};

export default function ActivityDetailPage({ params }: { params: { id: string } }) {
  return <ActivityDetailClient id={params.id} />;
}
