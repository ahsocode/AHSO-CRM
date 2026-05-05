import { DocumentTemplateStatus, DocumentType } from "@prisma/client";
import type { TemplateRuntimeStatus } from "./template-registry";

export const TEMPLATE_EDITOR_TYPES: DocumentType[] = ["QUOTATION", "CONTRACT"];

export const A4_PAGE_WIDTH_MM = 210;
export const A4_PAGE_HEIGHT_MM = 297;
export const DEFAULT_GRID_MM = 5;
export const DEFAULT_PAGE_MARGIN_MM = {
  top: 12,
  right: 12,
  bottom: 12,
  left: 12
} as const;

export type TemplateBoxType =
  | "text"
  | "image"
  | "key_value_table"
  | "line_items_table"
  | "signature_block";

export type TemplateLanguageKey = "vi" | "viEn";

export interface TemplateLocalizedText {
  vi: string;
  viEn?: string;
}

export interface TemplateBoxStyle {
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "center" | "bottom";
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
}

export interface TemplateBoxBase {
  id: string;
  type: TemplateBoxType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  visible?: boolean;
  style?: TemplateBoxStyle;
}

export interface TemplateTextBox extends TemplateBoxBase {
  type: "text";
  content: {
    text: TemplateLocalizedText;
  };
}

export interface TemplateImageBox extends TemplateBoxBase {
  type: "image";
  content: {
    src: string;
    alt?: string;
    fit?: "contain" | "cover";
  };
}

export interface TemplateKeyValueRow {
  id: string;
  label: TemplateLocalizedText;
  value: string;
}

export interface TemplateKeyValueTableBox extends TemplateBoxBase {
  type: "key_value_table";
  content: {
    rows: TemplateKeyValueRow[];
    labelWidth?: number;
  };
}

export interface TemplateLineItemsColumn {
  id: string;
  label: TemplateLocalizedText;
  value: string;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface TemplateLineItemsTableBox extends TemplateBoxBase {
  type: "line_items_table";
  content: {
    source: string;
    columns: TemplateLineItemsColumn[];
    emptyText?: TemplateLocalizedText;
  };
}

export interface TemplateSignatureBlockBox extends TemplateBoxBase {
  type: "signature_block";
  content: {
    leftTitle: TemplateLocalizedText;
    rightTitle: TemplateLocalizedText;
    leftCaption?: TemplateLocalizedText;
    rightCaption?: TemplateLocalizedText;
  };
}

export type TemplateBox =
  | TemplateTextBox
  | TemplateImageBox
  | TemplateKeyValueTableBox
  | TemplateLineItemsTableBox
  | TemplateSignatureBlockBox;

export interface DocumentTemplatePage {
  id: string;
  boxes: TemplateBox[];
}

export interface DocumentTemplateLayout {
  version: 1;
  page: {
    widthMm: number;
    heightMm: number;
    gridMm: number;
    marginMm: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  pages: DocumentTemplatePage[];
}

export interface TemplateValidationIssue {
  boxId?: string;
  code: "out_of_bounds" | "overlap" | "overflow" | "invalid";
  severity: "error" | "warning";
  message: string;
}

export interface TemplateTokenDefinition {
  key: string;
  label: string;
  description: string;
}

export interface TemplateTokenGroup {
  id: string;
  label: string;
  tokens: TemplateTokenDefinition[];
}

export interface TemplateBoxLibraryItem {
  type: TemplateBoxType;
  label: string;
  description: string;
  defaultBox: TemplateBox;
}

export interface TemplateCatalog {
  type: DocumentType;
  label: string;
  defaultLayout: DocumentTemplateLayout;
  boxLibrary: TemplateBoxLibraryItem[];
  tokenGroups: TemplateTokenGroup[];
  sampleData: Record<string, unknown>;
}

export interface DocumentTemplateVariantPayload {
  id: string;
  type: DocumentType;
  name: string;
  status: DocumentTemplateStatus;
  isActive: boolean;
  version: number;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  basedOnVariantId: string | null;
  createdAt: string;
  updatedAt: string;
  layoutJson: DocumentTemplateLayout;
  validationIssues?: TemplateValidationIssue[];
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface TemplateRegistrySummary {
  type: DocumentType;
  label: string;
  templateDir: string;
  prefix: string;
  style: "modern" | "classic";
  entityType: string;
  phase: number;
  runtimeStatus: TemplateRuntimeStatus;
  endUserEnabled: boolean;
  editorEnabled: boolean;
  usesVariantRuntime: boolean;
}

export function isTemplateEditorEnabled(type: DocumentType) {
  return TEMPLATE_EDITOR_TYPES.includes(type);
}
