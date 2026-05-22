"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAddSurveyNote } from "@/hooks/use-surveys";
import { SURVEY_NOTE_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { SurveyNote, SurveyNoteType } from "@/lib/types";
import { SurveyNoteTypeBadge } from "./survey-note-type-badge";
import { surveyNoteFormSchema, SurveyNoteFormValues } from "./form-schemas";

const NOTE_TYPES: { value: SurveyNoteType; label: string }[] = (
  Object.keys(SURVEY_NOTE_TYPE_LABELS) as SurveyNoteType[]
).map((key) => ({ value: key, label: SURVEY_NOTE_TYPE_LABELS[key] }));

interface SurveyNotesSectionProps {
  surveyId: string;
  projectId?: string | null;
  notes: SurveyNote[];
}

export function SurveyNotesSection({ surveyId, projectId, notes }: SurveyNotesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const addNote = useAddSurveyNote(projectId ?? "");

  const form = useForm<SurveyNoteFormValues>({
    resolver: zodResolver(surveyNoteFormSchema),
    defaultValues: { type: "GENERAL", content: "", isImportant: false },
  });

  const onSubmit = async (values: SurveyNoteFormValues) => {
    await addNote.mutateAsync({ surveyId, payload: values });
    form.reset();
    setShowForm(false);
  };

  const importantNotes = notes.filter((n) => n.isImportant);
  const regularNotes = notes.filter((n) => !n.isImportant);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{notes.length} ghi chú</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Hủy" : "Thêm ghi chú"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary-light/40 bg-primary-bg/20">
          <CardContent className="pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loại ghi chú</FormLabel>
                        <SelectRoot value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {NOTE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </SelectRoot>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isImportant"
                    render={({ field }) => (
                      <FormItem className="flex items-end gap-2 pb-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Đánh dấu quan trọng</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nội dung</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Nhập nội dung ghi chú..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={addNote.isPending}>
                    {addNote.isPending ? "Đang lưu..." : "Lưu ghi chú"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {importantNotes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-warning">Quan trọng</p>
          {importantNotes.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      )}

      {regularNotes.length > 0 && (
        <div className="space-y-2">
          {importantNotes.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Còn lại</p>
          )}
          {regularNotes.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      )}

      {notes.length === 0 && !showForm && (
        <p className="py-8 text-center text-sm text-text-muted">Chưa có ghi chú nào</p>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: SurveyNote }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <SurveyNoteTypeBadge type={note.type} />
          {note.isImportant && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
        </div>
        <span className="shrink-0 text-xs text-text-muted">{formatDateTime(note.createdAt)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{note.content}</p>
      {note.createdBy && (
        <p className="mt-1 text-xs text-text-muted">{note.createdBy.name}</p>
      )}
    </div>
  );
}
