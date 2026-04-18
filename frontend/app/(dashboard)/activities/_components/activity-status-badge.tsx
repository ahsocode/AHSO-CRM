'use client';

import { Badge } from '@/components/ui/badge';

const ACTIVITY_TYPE_CONFIG: Record<
  string,
  { label: string; className: string; icon: string }
> = {
  CALL: { label: 'Cuộc gọi', className: 'bg-[#D6EAF8] text-[#1A5276]', icon: '📞' },
  EMAIL: { label: 'Email', className: 'bg-[#E8E8E8] text-[#4A4A4A]', icon: '📧' },
  MEETING: { label: 'Họp mặt', className: 'bg-[#D5F5E3] text-[#1E5631]', icon: '👥' },
  SURVEY: { label: 'Khảo sát', className: 'bg-[#FDEBD0] text-[#7D4E00]', icon: '📋' },
  DEMO: { label: 'Demo', className: 'bg-[#E8DAEF] text-[#6C3483]', icon: '🎬' },
  NOTE: { label: 'Ghi chú', className: 'bg-[#E8E8E8] text-[#4A4A4A]', icon: '📝' },
  FOLLOWUP: { label: 'Theo dõi', className: 'bg-[#D0EFE8] text-[#0E6655]', icon: '↻' },
};

const COMPLETION_CONFIG = {
  true: { label: 'Hoàn tất', className: 'bg-[#D5F5E3] text-[#1E5631]' },
  false: { label: 'Chưa xong', className: 'bg-[#FADBD8] text-[#922B21]' },
};

interface ActivityStatusBadgeProps {
  type: string;
  variant?: 'type' | 'completion';
  isCompleted?: boolean;
  showIcon?: boolean;
}

export function ActivityStatusBadge({
  type,
  variant = 'type',
  isCompleted,
  showIcon = false,
}: ActivityStatusBadgeProps) {
  if (variant === 'completion' && isCompleted !== undefined) {
    const config = COMPLETION_CONFIG[isCompleted ? 'true' : 'false'];
    return <Badge className={config.className}>{config.label}</Badge>;
  }

  const config = ACTIVITY_TYPE_CONFIG[type] || { label: type, className: 'bg-gray-100', icon: '●' };

  return (
    <Badge className={config.className}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}
