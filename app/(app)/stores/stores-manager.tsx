"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { storeInputSchema, type StoreInput } from "@/lib/schemas/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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

export type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  contact: string | null;
};

function emptyToNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

export function StoresManager({
  userId,
  initialStores,
}: {
  userId: string;
  initialStores: StoreRow[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [deleting, setDeleting] = useState<StoreRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<StoreInput>({
    resolver: zodResolver(storeInputSchema),
    defaultValues: { name: "", address: "", contact: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", address: "", contact: "" });
    setFormOpen(true);
  }

  function openEdit(s: StoreRow) {
    setEditing(s);
    form.reset({
      name: s.name,
      address: s.address ?? "",
      contact: s.contact ?? "",
    });
    setFormOpen(true);
  }

  async function onSubmit(values: StoreInput) {
    setSubmitting(true);
    const payload = {
      name: values.name,
      address: emptyToNull(values.address),
      contact: emptyToNull(values.contact),
    };
    const { error } = editing
      ? await supabase.from("stores").update(payload).eq("id", editing.id)
      : await supabase
          .from("stores")
          .insert({ ...payload, owner_ngo_rep_id: userId });
    setSubmitting(false);

    if (error) {
      toast.error((error as PostgrestError).message);
      return;
    }
    toast.success(editing ? "店家已更新" : "店家已新增");
    setFormOpen(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase
      .from("stores")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleting.id);
    if (error) {
      toast.error((error as PostgrestError).message);
      return;
    }
    toast.success("店家已刪除");
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={openCreate} className="w-full" size="sm">
        <Plus className="mr-1 size-4" /> 新增店家
      </Button>

      {initialStores.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          尚無店家，點上方按鈕新增。
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店家名稱</TableHead>
                <TableHead>地址</TableHead>
                <TableHead>聯絡資訊</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialStores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.address ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.contact ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="編輯"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="刪除"
                      onClick={() => setDeleting(s)}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯店家" : "新增店家"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>店家名稱</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地址（選填）</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>聯絡資訊（選填）</FormLabel>
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

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除店家？</AlertDialogTitle>
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
