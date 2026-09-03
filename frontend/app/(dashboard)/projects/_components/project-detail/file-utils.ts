import { apiClient } from "@/lib/api-client";
import {
  BUSINESS_DOCUMENT_EXTENSIONS,
  BUSINESS_DOCUMENT_MAX_FILE_SIZE,
  SURVEY_MEDIA_EXTENSIONS,
  SURVEY_MEDIA_MAX_FILE_SIZE
} from "./constants";

export function validateBusinessDocumentFile(file: File) {
  return validateFileExtensionAndSize(file, BUSINESS_DOCUMENT_EXTENSIONS, BUSINESS_DOCUMENT_MAX_FILE_SIZE, "PDF, PNG, JPG, XLSX hoặc DOCX");
}

export function validateSurveyMediaFile(file: File) {
  return validateFileExtensionAndSize(
    file,
    SURVEY_MEDIA_EXTENSIONS,
    SURVEY_MEDIA_MAX_FILE_SIZE,
    "ảnh, video, PDF, DOCX hoặc XLSX"
  );
}

function validateFileExtensionAndSize(file: File, allowedExtensions: string[], maxSize: number, allowedText: string) {
  if (file.size > maxSize) {
    return `Dung lượng tối đa là ${formatFileSize(maxSize)}. File hiện tại ${formatFileSize(file.size)}.`;
  }

  const extension = getFileExtension(file.name);
  if (!extension || !allowedExtensions.includes(extension)) {
    return `Chỉ hỗ trợ ${allowedText}.`;
  }

  return null;
}

function getFileExtension(filename: string) {
  const normalized = filename.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return normalized.slice(dotIndex);
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  const sizeInKb = size / 1024;
  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(sizeInKb >= 100 ? 0 : 1)} KB`;
  }

  const sizeInMb = sizeInKb / 1024;
  return `${sizeInMb.toFixed(sizeInMb >= 100 ? 0 : 1)} MB`;
}

export async function openSecureFile(path: string, filename: string) {
  const blobUrl = await createSecureBlobUrl(path);
  const openedWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    downloadBlobUrl(blobUrl, filename);
  }

  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}

export async function downloadSecureFile(path: string, filename: string) {
  const blobUrl = await createSecureBlobUrl(path);
  downloadBlobUrl(blobUrl, filename);
  window.URL.revokeObjectURL(blobUrl);
}

async function createSecureBlobUrl(path: string) {
  const response = await apiClient.get(path, { responseType: "blob" });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  return window.URL.createObjectURL(blob);
}

export function downloadBlobUrl(blobUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = blobUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
}
