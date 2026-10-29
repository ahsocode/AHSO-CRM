"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useDownloadDocument, usePreviewDocument, useRenderDocument } from "@/hooks/use-documents";
import { useProjectDocumentReadiness } from "@/hooks/use-projects";
import { toast } from "@/hooks/use-toast";
import { DocumentSourceDialog } from "./document-source-dialog";
import { isSourceDocumentType, type SourceDocumentType } from "./document-source-fields";
import { getDocumentErrorMessage } from "./document-errors";

export function DocumentGenerationTable({ projectId }: { projectId: string }) {
  const { hasPermission } = useAuth();
  const canView = hasPermission("documents.view");
  const canCreate = hasPermission("documents.create");
  const readiness = useProjectDocumentReadiness(projectId, canView);
  const preview = usePreviewDocument();
  const render = useRenderDocument();
  const download = useDownloadDocument();
  const queryClient = useQueryClient();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceRow, setSourceRow] = useState<{type: SourceDocumentType; entityId: string; label: string} | null>(null);
  if (!canView) return <p className="text-sm text-text-secondary">Bạn chưa có quyền xem tài liệu.</p>;
  if (readiness.isLoading) return <p role="status">Đang kiểm tra dữ liệu tài liệu…</p>;
  if (readiness.isError) return <p role="alert">{getDocumentErrorMessage(readiness.error)}</p>;
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); }
    catch (error) { toast({ title: "Không thực hiện được thao tác tài liệu", description: getDocumentErrorMessage(error), variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return <section aria-label="Sinh tài liệu theo loại" className="space-y-3 rounded-2xl bg-bg-card p-4">
    <h3 className="text-lg font-semibold text-text-primary">Tạo và xem trước tài liệu</h3>
    {!canCreate ? <p className="text-sm text-text-secondary">Bạn có quyền xem tài liệu; cần quyền tạo tài liệu để lưu bản PDF.</p> : null}
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr><th className="p-3">Loại tài liệu</th><th className="p-3">Dữ liệu</th><th className="p-3">Thao tác</th></tr></thead>
        <tbody>{readiness.data?.map(row => {
          const ready = row.readiness === "ready" && Boolean(row.entityId);
          const reason = row.missingFields.map(field => field.message).join(" ");
          return <tr key={row.type} data-document-type={row.type}>
            <th scope="row" className="p-3 font-medium">{row.label}</th>
            <td className="max-w-lg p-3"><p>{ready ? "Đủ dữ liệu" : `Thiếu: ${reason}`}</p></td>
            <td className="p-3"><div className="flex flex-wrap gap-2">
              {canCreate && isSourceDocumentType(row.type) ? <Button size="sm" variant="outline" disabled={!row.entityId || busy} title={row.entityId ? "Nhập dữ liệu thực tế" : reason}
                onClick={() => { if (row.entityId && isSourceDocumentType(row.type)) setSourceRow({type:row.type, entityId:row.entityId, label:row.label}); }}>Nhập dữ liệu</Button> : null}
              <Button size="sm" variant="outline" disabled={!ready || busy} title={ready ? "Xem trước tài liệu" : reason}
                onClick={() => run(async () => { setPreviewHtml(await preview.mutateAsync({ type: row.type, entityId: row.entityId!, lang: "vi" })); })}>Xem trước</Button>
              {canCreate ? <Button size="sm" disabled={!ready || busy} title={ready ? "Tạo bản PDF" : reason}
                onClick={() => run(async () => {
                  await render.mutateAsync({ type: row.type, entityId: row.entityId!, payload: {language: "vi", projectId} });
                  await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
                  toast({ title: "Đã tạo tài liệu", description: row.label });
                })}>Tạo</Button> : null}
              {row.generated ? <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => download.mutateAsync({ downloadUrl: row.generated!.downloadUrl, filename: row.label }))}>Tải bản đã tạo</Button> : null}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {sourceRow && canCreate ? <DocumentSourceDialog key={`${sourceRow.type}:${sourceRow.entityId}`} projectId={projectId} {...sourceRow} onClose={() => setSourceRow(null)} /> : null}
    <Dialog open={previewHtml !== null} onOpenChange={open => { if (!open) setPreviewHtml(null); }}>
      <DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>Xem trước tài liệu</DialogTitle></DialogHeader>
        <iframe title="Nội dung tài liệu xem trước" sandbox="" srcDoc={previewHtml ?? ""} className="h-[70vh] w-full bg-bg-card" />
      </DialogContent>
    </Dialog>
  </section>;
}
