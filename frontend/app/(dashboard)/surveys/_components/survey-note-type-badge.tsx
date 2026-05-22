"use client";

import { SURVEY_NOTE_TYPE_COLORS, SURVEY_NOTE_TYPE_LABELS } from "@/lib/constants";
import type { SurveyNoteType } from "@/lib/types";

interface SurveyNoteTypeBadgeProps {
  type: SurveyNoteType;
}

export function SurveyNoteTypeBadge({ type }: SurveyNoteTypeBadgeProps) {
  const label = SURVEY_NOTE_TYPE_LABELS[type] ?? type;
  const colorClass = SURVEY_NOTE_TYPE_COLORS[type] ?? "text-text-secondary bg-bg-hover";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
