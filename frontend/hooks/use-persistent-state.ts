"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

/**
 * useState thay thế có ghi nhớ qua localStorage — dùng cho bộ lọc danh sách
 * (status, ngành, người phụ trách...) để sales không phải lọc lại cùng một
 * bộ điều kiện mỗi lần quay lại trang.
 *
 * Hydrate sau mount (không đọc localStorage trong initializer) để tránh
 * hydration mismatch với SSR của App Router.
 */
export function usePersistentState<T>(
  storageKey: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue);
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // localStorage không khả dụng (private mode...) — dùng default
    }
    hydratedRef.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ghi thất bại không được làm hỏng UI
    }
  }, [storageKey, value]);

  return [value, setValue];
}
