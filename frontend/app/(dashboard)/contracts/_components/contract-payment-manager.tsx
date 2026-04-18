"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateContractPayment } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { ProjectDetailPayment } from "@/lib/types";
import {
  defaultPaymentFormValues,
  paymentFormSchema,
  type PaymentFormValues
} from "./form-schemas";
import { ErrorText, Field, Label } from "./form-primitives";

export function ContractPaymentManager({
  contractId,
  payments
}: {
  contractId: string;
  payments: ProjectDetailPayment[];
}) {
  const createPaymentMutation = useCreateContractPayment(contractId);
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: defaultPaymentFormValues
  });

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Cash Flow</p>
        <CardTitle>Lịch sử thanh toán</CardTitle>
        <p className="mt-2 text-sm text-text-secondary">
          Log thanh toán tại đây để công nợ và reports phản ánh lại ngay sau khi thu tiền.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-4"
          onSubmit={form.handleSubmit((values) => {
            createPaymentMutation.mutate(values, {
              onSuccess: () => {
                form.reset({
                  ...defaultPaymentFormValues,
                  paidAt: new Date().toISOString().slice(0, 10)
                });
              }
            });
          })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <Label htmlFor="payment-amount">Số tiền</Label>
              <Input
                id="payment-amount"
                min={0}
                step="1"
                type="number"
                {...form.register("amount", {
                  setValueAs: (value) => (value === "" ? 0 : Number(value))
                })}
              />
              <ErrorText message={form.formState.errors.amount?.message} />
            </Field>

            <Field>
              <Label htmlFor="payment-paidAt">Ngày thanh toán</Label>
              <Input id="payment-paidAt" type="date" {...form.register("paidAt")} />
              <ErrorText message={form.formState.errors.paidAt?.message} />
            </Field>

            <Field>
              <Label htmlFor="payment-method">Phương thức</Label>
              <Input id="payment-method" placeholder="Chuyển khoản / Tiền mặt" {...form.register("method")} />
              <ErrorText message={form.formState.errors.method?.message} />
            </Field>

            <Field>
              <Label htmlFor="payment-reference">Mã tham chiếu</Label>
              <Input id="payment-reference" placeholder="UNC0426-001" {...form.register("reference")} />
              <ErrorText message={form.formState.errors.reference?.message} />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="payment-notes">Ghi chú</Label>
              <Textarea
                id="payment-notes"
                placeholder="Diễn giải thanh toán, người xác nhận hoặc lưu ý công nợ."
                {...form.register("notes")}
              />
              <ErrorText message={form.formState.errors.notes?.message} />
            </Field>
          </div>

          {createPaymentMutation.isError ? (
            <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
              {getApiErrorMessage(createPaymentMutation.error, "Không thể tạo log thanh toán.")}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button disabled={createPaymentMutation.isPending} type="submit">
              {createPaymentMutation.isPending ? "Đang ghi nhận..." : "Ghi nhận thanh toán"}
            </Button>
          </div>
        </form>

        {payments.length === 0 ? (
          <EmptyState
            title="Chưa có thanh toán"
            description="Khi thu tiền được log vào hệ thống, card này sẽ phản ánh ngay dòng tiền và công nợ."
          />
        ) : (
          payments.map((payment) => (
            <article key={payment.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-text-primary">
                    <CurrencyDisplay amount={payment.amount} short />
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {payment.method ?? "Chưa rõ phương thức"} · {payment.reference ?? "Chưa có mã tham chiếu"}
                  </p>
                  {payment.notes ? <p className="mt-2 text-sm text-text-secondary">{payment.notes}</p> : null}
                </div>
                <div className="text-right text-sm text-text-secondary">{formatDate(payment.paidAt)}</div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
