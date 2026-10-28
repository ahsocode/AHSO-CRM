"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-client";

export interface FormToast {
  /** "Đã lưu" (or a custom message). */
  success: (message?: string) => void;
  /** "Không lưu được: {reason}". `reason` can be a string or any thrown error (API message extracted). */
  error: (reason?: unknown) => void;
}

/** Standard save feedback via sonner (the app's toast system). */
export function useFormToast(): FormToast {
  return useMemo<FormToast>(
    () => ({
      success: (message = "Đã lưu") => {
        toast.success(message);
      },
      error: (reason?: unknown) => {
        const text = typeof reason === "string" ? reason : getApiErrorMessage(reason, "đã xảy ra lỗi, vui lòng thử lại");
        toast.error(`Không lưu được: ${text}`);
      },
    }),
    []
  );
}
