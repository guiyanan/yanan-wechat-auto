"use client";

import { FormEvent, useState } from "react";
import { Mail, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import { useEmailStore } from "@/store/emailStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailPage() {
  const recipients = useEmailStore((s) => s.recipients);
  const defaultRecipientId = useEmailStore((s) => s.defaultRecipientId);
  const sendHistory = useEmailStore((s) => s.sendHistory);
  const addRecipient = useEmailStore((s) => s.addRecipient);
  const removeRecipient = useEmailStore((s) => s.removeRecipient);
  const setDefaultRecipientId = useEmailStore((s) => s.setDefaultRecipientId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast.error("请输入有效邮箱");
      return;
    }
    addRecipient({ name, email });
    setName("");
    setEmail("");
    toast.success("已保存产品经理邮箱");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header>
          <p className="text-xs font-medium text-blue-600">JOTO小信</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            邮箱管理
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            这里维护产品经理邮箱组。批次页会通过企业邮箱 SMTP
            把已通过 Humanize 的候选文章批量发送给这些收件人。
          </p>
        </header>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">新增收件人</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="产品经理姓名"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pm@example.com"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Mail className="h-4 w-4" />
              保存
            </button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-900">
            产品经理邮箱 · {recipients.length}
          </h2>
          {recipients.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              还没有收件人。保存邮箱后,批次页就可以真实发送候选文章。
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {recipients.map((recipient) => {
                const isDefault = recipient.id === defaultRecipientId;
                return (
                  <li
                    key={recipient.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {recipient.name}
                        {isDefault && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            默认
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {recipient.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDefaultRecipientId(recipient.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        <Star className="h-3.5 w-3.5" />
                        设为默认
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecipient(recipient.id)}
                        aria-label={`删除 ${recipient.email}`}
                        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">发送历史</h2>
          {sendHistory.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">暂无发送记录。</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {sendHistory.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600"
                >
                  {item.articleCount} 篇候选已发送到{" "}
                  {(item.recipientEmails ?? [item.recipientEmail]).filter(Boolean).join("、")}
                  {item.status === "partial_success" && (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      部分成功
                    </span>
                  )}
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(item.sentAt).toLocaleString("zh-CN")} ·{" "}
                    {(item.messageIds ?? [item.messageId]).filter(Boolean).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
