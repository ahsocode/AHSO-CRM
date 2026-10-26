"use client";

import { ProjectCombobox } from "@/components/shared/project-combobox";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBomModels, useCreateProjectBom, useProjectBoms } from "@/hooks/use-boms";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatVND } from "@/lib/format";
import type { BomCreateInput } from "@/types/bom";

type CreateMode = "empty" | "model" | "copy";

const nameSchema = z.string().trim().min(2, "Tên BOM phải có ít nhất 2 ký tự").max(200);

export function BomCreateDialog({
  open,
  onOpenChange,
  projectId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const router = useRouter();
  const createMutation = useCreateProjectBom(projectId);
  const [mode, setMode] = useState<CreateMode>("empty");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceProjectId, setSourceProjectId] = useState(projectId);
  const [error, setError] = useState<string | null>(null);
  const sourceBomsQuery = useProjectBoms(open && mode === "copy" ? sourceProjectId : "");
  const sourceBoms = sourceBomsQuery.data ?? [];
  const modelsQuery = useBomModels({ status: "APPROVED", latestOnly: true, limit: 100 }, open && mode === "model");

  useEffect(() => {
    if (open) {
      setMode("empty");
      setName("");
      setNotes("");
      setSourceId("");
      setSourceProjectId(projectId);
      setError(null);
    }
  }, [open, projectId]);

  function handleModeChange(next: CreateMode) {
    setMode(next);
    setSourceId("");
  }

  function handleSubmit() {
    setError(null);
    const parsedName = nameSchema.safeParse(name);
    if (!parsedName.success) {
      setError(parsedName.error.issues[0]?.message ?? "Tên BOM chưa hợp lệ.");
      return;
    }
    if (mode !== "empty" && !sourceId) {
      setError(mode === "model" ? "Hãy chọn một mẫu máy." : "Hãy chọn BOM cần sao chép.");
      return;
    }
    const payload: BomCreateInput = {
      name: parsedName.data,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(mode !== "empty" ? { sourceBomId: sourceId } : {})
    };
    createMutation.mutate(payload, {
      onSuccess: (created) => {
        toast.success(`Đã tạo BOM ${created.code}.`);
        onOpenChange(false);
        router.push(`/projects/${projectId}/boms/${created.id}` as Route);
      },
      onError: (err) => setError(getApiErrorMessage(err, "Không thể tạo BOM."))
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-labelledby="bom-create-title" className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle id="bom-create-title">Tạo BOM</DialogTitle>
          <DialogDescription>BOM dự toán mới cho dự án này, ở trạng thái nháp.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="bom-create-name" className="text-sm font-semibold text-text-primary">
              Tên BOM
            </label>
            <Input
              id="bom-create-name"
              placeholder="Ví dụ: Máy kiểm tra ngoại quan số 1"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bom-create-notes" className="text-sm font-semibold text-text-primary">
              Ghi chú
            </label>
            <Textarea id="bom-create-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-text-primary">Tạo từ</legend>
            {(
              [
                ["empty", "BOM trống"],
                ["model", "Từ mẫu máy"],
                ["copy", "Sao chép BOM dự án khác"]
              ] as Array<[CreateMode, string]>
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="bom-create-mode"
                  checked={mode === value}
                  onChange={() => handleModeChange(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          {mode === "model" ? (
            <div className="space-y-1.5">
              <label htmlFor="bom-create-model" className="text-sm font-semibold text-text-primary">
                Mẫu máy (đã duyệt)
              </label>
              <Select id="bom-create-model" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">
                  {modelsQuery.isLoading ? "Đang tải..." : modelsQuery.data?.length ? "Chọn mẫu máy" : "Chưa có mẫu máy đã duyệt"}
                </option>
                {(modelsQuery.data ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.product?.name ?? model.name} · v{model.version} · {formatVND(model.total)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {mode === "copy" ? (
            <div className="space-y-1.5">
              <label htmlFor="bom-create-source-project" className="text-sm font-semibold text-text-primary">
                Dự án nguồn
              </label>
              <ProjectCombobox id="bom-create-source-project" value={sourceProjectId} onChange={(value) => { setSourceProjectId(value); setSourceId(""); }} placeholder="Chọn dự án nguồn" />
              <label htmlFor="bom-create-copy" className="text-sm font-semibold text-text-primary">
                BOM cần sao chép
              </label>
              <Select id="bom-create-copy" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">
                  {sourceBomsQuery.isLoading ? "Đang tải..." : sourceBoms.length ? "Chọn BOM" : "Dự án này chưa có BOM nào"}
                </option>
                {sourceBoms.map((bom) => (
                  <option key={bom.id} value={bom.id}>
                    {bom.code} · {bom.name} · {formatVND(bom.total)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {error ? <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" variant="primary" disabled={createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "Đang tạo..." : "Tạo BOM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
