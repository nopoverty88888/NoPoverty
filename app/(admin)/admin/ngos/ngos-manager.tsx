"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import {
  createNgoAccountSchema,
  type CreateNgoAccountInput,
} from "@/lib/schemas/ngo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type NgoWithMembers = {
  id: string;
  name: string;
  members: { name: string; email: string; role: string }[];
};

export function NgosManager({ ngos }: { ngos: NgoWithMembers[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    email: string;
    password: string;
    generated: boolean;
  } | null>(null);

  const form = useForm<CreateNgoAccountInput>({
    resolver: zodResolver(createNgoAccountSchema),
    defaultValues: { ngoName: "", repName: "", repEmail: "", password: "" },
  });

  async function onCreate(values: CreateNgoAccountInput) {
    setSubmitting(true);
    const res = await fetch("/api/ngos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json: {
      email?: string;
      password?: string;
      generated?: boolean;
      error?: string;
    } = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok || !json.email || !json.password) {
      toast.error(json.error ?? "建立失敗");
      return;
    }
    setCreateOpen(false);
    form.reset();
    setResult({
      email: json.email,
      password: json.password,
      generated: Boolean(json.generated),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setCreateOpen(true)} size="sm">
        <Plus className="mr-1 size-4" /> 新增 NGO 帳號
      </Button>

      <div className="space-y-3">
        {ngos.map((ngo) => (
          <Card key={ngo.id}>
            <CardHeader>
              <CardTitle className="text-base">{ngo.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {ngo.members.length === 0 ? (
                <p className="text-muted-foreground">（尚無帳號）</p>
              ) : (
                ngo.members.map((m) => (
                  <div
                    key={m.email}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0 truncate">
                      {m.name}
                      <span className="text-muted-foreground">（{m.email}）</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {m.role === "lixin" ? "立心" : "NGO 代表"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新增 NGO 帳號</DialogTitle>
            <DialogDescription>
              建立 NGO 並同時開通其代表的登入帳號。
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="ngoName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NGO 名稱</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="repName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代表姓名</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="repEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代表 Email（登入帳號）</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密碼（選填，留空自動產生）</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="留空則系統自動產生一組臨時密碼"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "建立中…" : "建立帳號"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Result dialog: one-time temporary password */}
      <Dialog open={result !== null} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>帳號已建立</DialogTitle>
            <DialogDescription>
              {result?.generated
                ? "系統已產生一組臨時密碼，請複製轉交給代表，登入後請其修改。此密碼僅顯示一次。"
                : "請將您設定的密碼轉交給代表，建議登入後修改。此密碼不會再次顯示。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{result?.email}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {result?.generated ? "臨時密碼" : "密碼"}
              </span>
              <code className="rounded bg-muted px-2 py-0.5 font-mono">
                {result?.password}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResult(null)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
