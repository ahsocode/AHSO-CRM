"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateContractMilestone,
  useUpdateContractMilestone
} from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import { ContractDetailMilestone, MilestoneStatus } from "@/lib/types";
import {
  defaultMilestoneFormValues,
  milestoneFormSchema,
  type MilestoneFormValues
} from "./form-schemas";
import { ErrorText, Field, Label } from "./form-primitives";

const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: "Chờ triển khai",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Đã xong",
  ACCEPTED: "Đã nghiệm thu"
};

const MILESTONE_STATUS_BADGE: Record<MilestoneStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-info-bg text-info",
  DONE: "bg-success-bg text-success",
  ACCEPTED: "bg-primary/10 text-primary"
};

export function ContractMilestoneManager({
  contractId,
  milestones
}: {
  contractId: string;
  milestones: ContractDetailMilestone[];
}) {
  const createMilestoneMutation = useCreateContractMilestone(contractId);
  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: defaultMilestoneFormValues
  });

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Delivery Plan</p>
        <CardTitle>Milestone triển khai</CardTitle>
        <p className="mt-2 text-sm text-text-secondary">
          Thêm và điều chỉnh milestone ngay tại hợp đồng để finance, delivery và sales bám cùng một timeline.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <form
          className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-4"
          onSubmit={form.handleSubmit((values) => {
            createMilestoneMutation.mutate(values, {
              onSuccess: () => {
                form.reset(defaultMilestoneFormValues);
              }
            });
          })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2">
              <Label htmlFor="milestone-name">Tên milestone</Label>
              <Input id="milestone-name" placeholder="Ví dụ: FAT tại xưởng" {...form.register("name")} />
              <ErrorText message={form.formState.errors.name?.message} />
            </Field>

            <Field>
              <Label htmlFor="milestone-status">Trạng thái</Label>
              <Select id="milestone-status" {...form.register("status")}>
                {Object.entries(MILESTONE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <ErrorText message={form.formState.errors.status?.message} />
            </Field>

            <Field>
              <Label htmlFor="milestone-dueDate">Hạn hoàn thành</Label>
              <Input id="milestone-dueDate" type="date" {...form.register("dueDate")} />
              <ErrorText message={form.formState.errors.dueDate?.message} />
            </Field>

            <Field>
              <Label htmlFor="milestone-paymentAmount">Ngân sách / giá trị</Label>
              <Input
                id="milestone-paymentAmount"
                min={0}
                step="1"
                type="number"
                {...form.register("paymentAmount", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value))
                })}
              />
              <ErrorText message={form.formState.errors.paymentAmount?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="milestone-description">Mô tả</Label>
              <Textarea
                id="milestone-description"
                placeholder="Nội dung bàn giao, checklist kỹ thuật hoặc lưu ý cho đội triển khai."
                {...form.register("description")}
              />
              <ErrorText message={form.formState.errors.description?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="milestone-notes">Ghi chú nội bộ</Label>
              <Textarea
                id="milestone-notes"
                placeholder="Ghi chú nghiệm thu, điều kiện thanh toán hoặc phụ thuộc kỹ thuật."
                {...form.register("notes")}
              />
              <ErrorText message={form.formState.errors.notes?.message} />
            </Field>
          </div>

          {createMilestoneMutation.isError ? (
            <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
              {getApiErrorMessage(createMilestoneMutation.error, "Không thể tạo milestone.")}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button disabled={createMilestoneMutation.isPending} type="submit">
              {createMilestoneMutation.isPending ? "Đang lưu..." : "Thêm milestone"}
            </Button>
          </div>
        </form>

        {milestones.length === 0 ? (
          <EmptyState
            title="Chưa có milestone"
            description="Thêm milestone đầu tiên để theo dõi tiến độ triển khai và nghiệm thu."
          />
        ) : (
          <div className="space-y-4">
            {milestones.map((milestone) => (
              <MilestoneEditor key={milestone.id} contractId={contractId} milestone={milestone} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MilestoneEditor({
  contractId,
  milestone
}: {
  contractId: string;
  milestone: ContractDetailMilestone;
}) {
  const updateMilestoneMutation = useUpdateContractMilestone(contractId);
  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: {
      name: milestone.name,
      description: milestone.description ?? "",
      dueDate: milestone.dueDate ? milestone.dueDate.slice(0, 10) : "",
      status: milestone.status,
      paymentAmount: milestone.paymentAmount || undefined,
      notes: milestone.notes ?? ""
    }
  });

  return (
    <article className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-text-primary">{milestone.name}</p>
          <p className="mt-1 text-sm text-text-secondary">
            {milestone.dueDate ? `Hạn ${formatDate(milestone.dueDate)}` : "Chưa có hạn"} ·{" "}
            {milestone.completedAt ? `Hoàn tất ${formatDateTime(milestone.completedAt)}` : "Chưa hoàn tất"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MILESTONE_STATUS_BADGE[milestone.status]}`}>
          {MILESTONE_STATUS_LABELS[milestone.status]}
        </span>
      </div>

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={form.handleSubmit((values) => {
          updateMilestoneMutation.mutate({
            milestoneId: milestone.id,
            payload: values
          });
        })}
      >
        <Field className="md:col-span-2">
          <Label htmlFor={`milestone-${milestone.id}-name`}>Tên milestone</Label>
          <Input id={`milestone-${milestone.id}-name`} {...form.register("name")} />
          <ErrorText message={form.formState.errors.name?.message} />
        </Field>

        <Field>
          <Label htmlFor={`milestone-${milestone.id}-status`}>Trạng thái</Label>
          <Select id={`milestone-${milestone.id}-status`} {...form.register("status")}>
            {Object.entries(MILESTONE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <ErrorText message={form.formState.errors.status?.message} />
        </Field>

        <Field>
          <Label htmlFor={`milestone-${milestone.id}-dueDate`}>Hạn hoàn thành</Label>
          <Input id={`milestone-${milestone.id}-dueDate`} type="date" {...form.register("dueDate")} />
          <ErrorText message={form.formState.errors.dueDate?.message} />
        </Field>

        <Field>
          <Label htmlFor={`milestone-${milestone.id}-paymentAmount`}>Ngân sách / giá trị</Label>
          <Input
            id={`milestone-${milestone.id}-paymentAmount`}
            min={0}
            step="1"
            type="number"
            {...form.register("paymentAmount", {
              setValueAs: (value) => (value === "" ? undefined : Number(value))
            })}
          />
          <ErrorText message={form.formState.errors.paymentAmount?.message} />
        </Field>

        <Field className="md:col-span-2">
          <Label htmlFor={`milestone-${milestone.id}-description`}>Mô tả</Label>
          <Textarea id={`milestone-${milestone.id}-description`} {...form.register("description")} />
          <ErrorText message={form.formState.errors.description?.message} />
        </Field>

        <Field className="md:col-span-2">
          <Label htmlFor={`milestone-${milestone.id}-notes`}>Ghi chú</Label>
          <Textarea id={`milestone-${milestone.id}-notes`} {...form.register("notes")} />
          <ErrorText message={form.formState.errors.notes?.message} />
        </Field>

        {updateMilestoneMutation.isError ? (
          <div className="md:col-span-2 rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
            {getApiErrorMessage(updateMilestoneMutation.error, "Không thể cập nhật milestone.")}
          </div>
        ) : null}

        <div className="md:col-span-2 flex justify-end">
          <Button disabled={updateMilestoneMutation.isPending} type="submit" variant="outline">
            {updateMilestoneMutation.isPending ? "Đang cập nhật..." : "Cập nhật milestone"}
          </Button>
        </div>
      </form>
    </article>
  );
}
