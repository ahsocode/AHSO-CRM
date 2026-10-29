import axios from "axios";
import { getApiErrorMessage } from "@/lib/api-client";

/** Document 422 responses carry field errors; Axios's generic message loses their explanation. */
export function getDocumentErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    let payload = error.response?.data;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { return getApiErrorMessage(error); }
    }
    if (payload && typeof payload === "object") {
      const errors = payload.errors as unknown;
      if (Array.isArray(errors) && errors.length) return errors.map(item => typeof item === "string" ? item : item.message).join("; ");
      if (typeof payload.message === "string") return payload.message;
    }
  }
  return getApiErrorMessage(error);
}

export function getDocumentFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {};
  let payload = error.response?.data;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return {}; }
  }
  const errors: Record<string, string> = {};
  if (Array.isArray(payload?.errors)) {
    for (const issue of payload.errors) {
      if (issue && typeof issue.field === "string" && typeof issue.message === "string") {
        errors[issue.field] = [errors[issue.field], issue.message].filter(Boolean).join("; ");
      }
    }
  }
  return errors;
}
