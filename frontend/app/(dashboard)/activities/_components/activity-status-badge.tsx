'use client';

import { ComponentProps } from 'react';
import { AppIcon } from '@/components/shared/app-icon';
import { Badge } from '@/components/ui/badge';
import { ACTIVITY_TYPE_CONFIG } from '@/lib/constants';

// Token Rule: màu lấy từ semantic class (CSS variables), icon dùng AppIcon —
// không hardcode hex, không dùng emoji.
const COMPLETION_CONFIG = {
  true: { label: 'Hoàn tất', className: 'bg-success-bg text-success' },
  false: { label: 'Chưa xong', className: 'bg-danger-bg text-danger' },
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

  const config =
    ACTIVITY_TYPE_CONFIG[type as keyof typeof ACTIVITY_TYPE_CONFIG] ??
    ({ label: type, className: 'bg-bg-hover text-text-secondary', icon: 'activity' } as const);

  return (
    <Badge className={config.className}>
      {showIcon ? (
        <AppIcon
          name={config.icon as ComponentProps<typeof AppIcon>['name']}
          className="mr-1 h-3.5 w-3.5"
        />
      ) : null}
      {config.label}
    </Badge>
  );
}
