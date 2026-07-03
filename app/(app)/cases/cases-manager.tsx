"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import {
  caseCreateSchema,
  caseEditSchema,
  type CaseCreateInput,
  type CaseEditInput,
} from "@/lib/schemas/case";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaseImportDialog } from "./case-import-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CaseRow = {
  id: string;
  name: string;
  note: string | null;
  idLast4: string;
};

function friendlyError(error: PostgrestError): string {
  if (error.code === "23505") return "此身分證字號在貴單位已存在";
  return error.message;
}

function emptyToNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

export function CasesManager({
  ngoId,
  userId,
  initialCases,
}: {
  ngoId: string;
  userId: string;
  initialCases: CaseRow[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CaseRow | null>(null);
  const [deleting, setDeleting] = useState<CaseRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const createForm = useForm<CaseCreateInput>({
    resolver: zodResolver(caseCreateSchema),
    defaultValues: { name: "", id_number: "", note: "" },
  });
  const editForm = useForm<CaseEditInput>({
    resolver: zodResolver(caseEditSchema),
    defaultValues: { name: "", note: "" },
  });

  function openCreate() {
    createForm.reset({ name: "", id_number: "", note: "" });
    setCreateOpen(true);
  }

  function openEdit(c: CaseRow) {
    editForm.reset({ name: c.name, note: c.note ?? "" });
    setEditing(c);
  }

  async function onCreate(values: CaseCreateInput) {
    setSubmitting(true);
    const { error } = await supabase.from("cases").insert({
      name: values.name,
      id_number: values.id_number,
      note: emptyToNull(values.note),
      ngo_id: ngoId,
      created_by_id: userId,
    });
    setSubmitting(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("個案已新增");
    setCreateOpen(false);
    router.refresh();
  }

  async function onEdit(values: CaseEditInput) {
    if (!editing) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("cases")
      .update({ name: values.name, note: emptyToNull(values.note) })
      .eq("id", editing.id);
    setSubmitting(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("個案已更新");
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase
      .from("cases")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleting.id);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("個案已刪除");
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={openCreate} className="sm:flex-1" size="sm">
          <Plus className="mr-1 size-4" /> 新增個案
        </Button>
        <CaseImportDialog ngoId={ngoId} userId={userId} />
      </div>

      {initialCases.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          尚無個案，點上方按鈕新增。
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>身分證</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialCases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    ****{c.idLast4}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="編輯"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="刪除"
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog (name + id_number + note) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新增個案</DialogTitle>
            <DialogDescription>
              身分證字號僅用於辨識，存檔後不可在系統內再次檢視（僅顯示後 4 碼）。
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(onCreate)}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="id_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>身分證字號</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（選填）</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "儲存中…" : "儲存"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog (name + note; id_number is fixed at creation) */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>編輯個案</DialogTitle>
            <DialogDescription>
              身分證 ****{editing?.idLast4} — 身分證字號不可修改，如需更正請刪除後重建。
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（選填）</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "儲存中…" : "儲存"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除個案？</AlertDialogTitle>
            <AlertDialogDescription>
              將刪除「{deleting?.name}」。此操作為軟刪除，歷史紀錄仍保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
