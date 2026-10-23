"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { usePermission } from "@/components/shared/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApproveBom, useBom, useCreateBomVersion, useReplaceBomLines, useUpdateBom } from "@/hooks/use-boms";
import { getApiErrorMessage } from "@/lib/api-client";
import { BOM_KIND_LABELS, COST_GROUP_LABELS } from "@/lib/constants";
import { buildLineInputs, computeTotals, isUnlinkedRow, rowsFromBom, type EditorRow } from "@/lib/bom-editor";
import { exportBomToExcel } from "@/lib/bom-excel";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BomImportDialog } from "./bom-import-dialog";
import { BomLinesTable } from "./bom-lines-table";
import { BomStatusBadge } from "./bom-status-badge";
import { SaveAsModelDialog } from "./save-as-model-dialog";

export function BomEditor({ bomId }: { bomId: string }) {
  const router = useRouter();
  const bomQuery = useBom(bomId);
  const bom = bomQuery.data;
  const updateMutation = useUpdateBom(bomId);
  const linesMutation = useReplaceBomLines(bomId);
  const approveMutation = useApproveBom();
  const versionMutation = useCreateBomVersion();

  const canEditProject = usePermission("projects.edit");
  const canEditModel = usePermission("materials.edit");
  const canEdit = bom?.kind === "MODEL" ? canEditModel : canEditProject;
  const canSaveAsModel = usePermission("materials.edit") && usePermission("projects.view");

  const [rows, setRows] = useState<EditorRow[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const loadedRef = useRef<string | null>(null);

  // Load server data into the editor; never overwrite unsaved edits on background refetches.
  useEffect(() => {
    if (!bom) return;
    const signature = `${bom.id}:${bom.updatedAt}`;
    if (loadedRef.current === signature) return;
    if (loadedRef.current?.startsWith(`${bom.id}:`) && dirty) return;
    loadedRef.current = signature;
    setRows(rowsFromBom(bom));
    setName(bom.name);
    setNotes(bom.notes ?? "");
    setDirty(false);
    setErrors([]);
  }, [bom, dirty]);

  const readOnly = !bom || bom.status !== "DRAFT" || !canEdit;
  const totals = useMemo(() => computeTotals(rows), [rows]);
  const unlinkedCount = useMemo(() => rows.filter((row) => row.name.trim() && isUnlinkedRow(row)).length, [rows]);

  const handleRowsChange = useCallback((updater: (current: EditorRow[]) => EditorRow[]) => {
    setRows(updater);
    setDirty(true);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!bom) return false;
    const built = buildLineInputs(rows);
    if (!built.ok) {
      setErrors(built.errors);
      toast.error("Còn dòng chưa hợp lệ, hãy kiểm tra lại.");
      return false;
    }
    if (!name.trim()) {
      setErrors(["Tên BOM không được để trống."]);
      return false;
    }
    setErrors([]);
    try {
      if (name.trim() !== bom.name || (notes.trim() || null) !== (bom.notes ?? null)) {
        await updateMutation.mutateAsync({ name: name.trim(), notes: notes.trim() || null });
      }
      const saved = await linesMutation.mutateAsync(built.lines);
      loadedRef.current = `${saved.id}:${saved.updatedAt}`;
      setRows(rowsFromBom(saved));
      setDirty(false);
      toast.success("Đã lưu BOM.");
      return true;
    } catch (error) {
      setErrors([getApiErrorMessage(error, "Không thể lưu BOM.")]);
      return false;
    }
  }, [bom, linesMutation, name, notes, rows, updateMutation]);

  // Ctrl/Cmd+S saves the draft
  useEffect(() => {
    if (readOnly) return;
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [readOnly, save]);

  async function handleApprove() {
    if (!bom) return;
    if (dirty && !(await save())) {
      setApproveOpen(false);
      return;
    }
    try {
      await approveMutation.mutateAsync(bom.id);
      toast.success("Đã duyệt BOM. BOM đã được khóa chỉnh sửa.");
      loadedRef.current = null;
    } catch (error) {
      setErrors([getApiErrorMessage(error, "Không thể duyệt BOM.")]);
    } finally {
      setApproveOpen(false);
    }
  }

  async function handleNewVersion() {
    if (!bom) return;
    try {
      const created = await versionMutation.mutateAsync(bom.id);
      toast.success("Đã tạo phiên bản mới (bản nháp).");
      router.push(editorHref(bom.kind, bom.projectId, created.id));
    } catch (error) {
      setErrors([getApiErrorMessage(error, "Không thể tạo phiên bản mới.")]);
    }
  }

  async function handleExport() {
    if (!bom) return;
    setIsExporting(true);
    try {
      await exportBomToExcel({ code: bom.code, name: bom.name, version: bom.version }, rows);
    } catch {
      toast.error("Không thể xuất Excel.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleImport(imported: EditorRow[], mode: "append" | "replace") {
    handleRowsChange((current) => (mode === "replace" ? imported : [...current, ...imported]));
    toast.success(`Đã thêm ${imported.length} dòng vào BOM. Nhớ bấm Lưu.`);
  }

  if (bomQuery.isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-96 w-full" />
      </div>
    );
  }

  if (bomQuery.isError || !bom) {
    return (
      <Card className="border border-danger/20">
        <CardContent className="p-6">
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {getApiErrorMessage(bomQuery.error, "Không thể tải BOM.")}
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPending = updateMutation.isPending || linesMutation.isPending;
  const backHref = (bom.kind === "MODEL" ? "/inventory/models" : `/projects/${bom.projectId}?tab=boms`) as Route;
  const isModel = bom.kind === "MODEL";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={BOM_KIND_LABELS[bom.kind]}
        title={`${bom.code} · ${bom.name}`}
        description={
          isModel
            ? `Mẫu máy${bom.product ? ` ${bom.product.code} · ${bom.product.name}` : ""} — phiên bản v${bom.version}`
            : `Dự án ${bom.project ? `${bom.project.code} · ${bom.project.name}` : ""} — phiên bản v${bom.version}`
        }
        action={
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
            {isModel ? "Về danh sách mẫu máy" : "Về dự án"}
          </Link>
        }
      />

      <Card className="border border-white/70">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <BomStatusBadge status={bom.status} />
            <Badge variant="info">v{bom.version}</Badge>
            {bom.sourceBom ? (
              <span className="text-sm text-text-secondary">
                Từ {bom.sourceBom.code} · v{bom.sourceBom.version}
              </span>
            ) : null}
            {readOnly && bom.status === "APPROVED" ? (
              <span className="text-sm text-text-secondary">
                BOM đã duyệt chỉ để xem. Muốn sửa, hãy tạo phiên bản mới.
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="bom-name" className="text-sm font-semibold text-text-primary">
                Tên BOM
              </label>
              <Input
                id="bom-name"
                value={name}
                readOnly={readOnly}
                onChange={(event) => {
                  setName(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bom-notes" className="text-sm font-semibold text-text-primary">
                Ghi chú
              </label>
              <Textarea
                id="bom-notes"
                rows={2}
                value={notes}
                readOnly={readOnly}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!readOnly ? (
              <>
                <Button type="button" variant="primary" disabled={isPending || !dirty} onClick={() => void save()}>
                  {isPending ? "Đang lưu..." : "Lưu"}
                </Button>
                <Button type="button" variant="outline" disabled={approveMutation.isPending} onClick={() => setApproveOpen(true)}>
                  Duyệt
                </Button>
                <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                  Nhập Excel
                </Button>
              </>
            ) : null}
            {bom.status === "APPROVED" && canEdit ? (
              <Button type="button" variant="primary" disabled={versionMutation.isPending} onClick={() => void handleNewVersion()}>
                {versionMutation.isPending ? "Đang tạo..." : "Tạo phiên bản mới"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={isExporting} onClick={() => void handleExport()}>
              {isExporting ? "Đang xuất..." : "Xuất Excel"}
            </Button>
            {!isModel && canSaveAsModel && bom.status !== "ARCHIVED" ? (
              <Button
                type="button"
                variant="outline"
                disabled={dirty}
                title={dirty ? "Hãy lưu BOM trước khi lưu thành mẫu máy" : undefined}
                onClick={() => setModelOpen(true)}
              >
                Lưu thành mẫu máy
              </Button>
            ) : null}
            {dirty ? <span className="text-sm text-accent">Có thay đổi chưa lưu</span> : null}
          </div>

          {errors.length > 0 ? (
            <div role="alert" className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
              {errors.slice(0, 6).map((message) => (
                <p key={message}>{message}</p>
              ))}
              {errors.length > 6 ? <p>Và {errors.length - 6} lỗi khác.</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <CardTitle>Tổng dự kiến theo nhóm</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {totals.byGroup.map((entry) => (
              <div key={entry.group} className="rounded-xl bg-bg-subtle px-4 py-3">
                <p className="text-xs font-semibold text-text-secondary">{COST_GROUP_LABELS[entry.group]}</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-text-primary">{formatVND(entry.amount)}</p>
              </div>
            ))}
            <div className="rounded-xl bg-primary-bg px-4 py-3">
              <p className="text-xs font-semibold text-primary">Tổng cộng</p>
              <p data-testid="bom-total" className="mt-1 text-base font-bold tabular-nums text-primary">
                {formatVND(totals.total)}
              </p>
            </div>
          </div>
          {unlinkedCount > 0 ? (
            <p className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
              {unlinkedCount} dòng chưa gắn mã vật tư. Cần gắn mã đầy đủ cho vật tư tồn kho trước khi gợi ý phân bổ hoặc
              lưu thành mẫu máy.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <CardTitle>Danh sách dòng ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <BomLinesTable rows={rows} readOnly={readOnly} onRowsChange={handleRowsChange} />
        </CardContent>
      </Card>

      <BomImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingCount={rows.length}
        onImport={handleImport}
      />
      {!isModel ? (
        <SaveAsModelDialog open={modelOpen} onOpenChange={setModelOpen} bomId={bom.id} defaultName={bom.name} />
      ) : null}

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duyệt BOM</DialogTitle>
            <DialogDescription>
              Sau khi duyệt, BOM bị khóa chỉnh sửa. Muốn sửa phải tạo phiên bản mới.
              {unlinkedCount > 0 ? ` Hiện còn ${unlinkedCount} dòng chưa gắn mã vật tư.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
              Hủy
            </Button>
            <Button type="button" variant="primary" disabled={approveMutation.isPending || isPending} onClick={() => void handleApprove()}>
              {approveMutation.isPending ? "Đang duyệt..." : "Xác nhận duyệt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function editorHref(kind: "PROJECT" | "MODEL", projectId: string | null, bomId: string): Route {
  return (kind === "MODEL" ? `/inventory/models/${bomId}` : `/projects/${projectId}/boms/${bomId}`) as Route;
}
