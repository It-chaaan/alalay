import { env } from "../config/env.js";

type EmailInput = { to: string; subject: string; html: string };

const brand = "#0f8a6b";
const preferencesUrl = `${env.APP_URL.replace(/\/$/, "")}/app/settings?tab=Notifications`;

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

function layout(title: string, intro: string, content: string) {
  return `<!doctype html><html><body style="margin:0;background:#f8f7f2;color:#0f172a;font-family:Arial,sans-serif"><div style="max-width:620px;margin:32px auto;padding:0 16px"><div style="background:${brand};color:white;padding:20px 24px;border-radius:18px 18px 0 0;font-size:22px;font-weight:700">Alalay</div><main style="background:white;padding:28px 24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 18px 18px"><h1 style="font-size:22px;margin:0 0 10px">${escapeHtml(title)}</h1><p style="color:#64748b;line-height:1.6">${escapeHtml(intro)}</p>${content}<hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0 16px"><p style="font-size:12px;color:#94a3b8">You’re receiving this because the notification is enabled in Alalay. <a href="${preferencesUrl}" style="color:${brand}">Manage your notification preferences</a>.</p></main></div></body></html>`;
}

function money(value: number) { return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export async function sendEmail(input: EmailInput) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
}

export function billDueEmail(bill: { title: string; amount: number; due_date: string }, days: number) {
  return { subject: `Bill due reminder: ${bill.title}`, html: layout("Bill due reminder", `${bill.title} is due in ${days} day${days === 1 ? "" : "s"}.`, `<div style="background:#f0fdf4;border-radius:14px;padding:18px"><p style="margin:0 0 8px;font-weight:700">${escapeHtml(bill.title)}</p><p style="margin:0;color:#475569">Amount: <strong>${money(bill.amount)}</strong><br>Due date: <strong>${escapeHtml(bill.due_date)}</strong></p></div>`) };
}

export function subscriptionRenewalEmail(subscription: { name: string; amount: number; renewal_date: string }, days: number) {
  return { subject: `Subscription renewal reminder: ${subscription.name}`, html: layout("Subscription renewal reminder", `${subscription.name} is scheduled to renew in ${days} day${days === 1 ? "" : "s"}.`, `<div style="background:#f0fdf4;border-radius:14px;padding:18px"><p style="margin:0 0 8px;font-weight:700">${escapeHtml(subscription.name)}</p><p style="margin:0;color:#475569">Amount: <strong>${money(subscription.amount)}</strong><br>Renewal date: <strong>${escapeHtml(subscription.renewal_date)}</strong></p></div>`) };
}

export function monthlySummaryEmail(summary: { month: string; income: number; expenses: number; billsPaid: number; billsOutstanding: number; savingsProgress: number; budgetPerformance: number }) {
  return { subject: `Your Alalay monthly summary for ${summary.month}`, html: layout("Your monthly summary", `Here’s how your finances looked in ${summary.month}.`, `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div style="padding:14px;background:#f8fafc;border-radius:12px"><small>Total income</small><br><strong>${money(summary.income)}</strong></div><div style="padding:14px;background:#f8fafc;border-radius:12px"><small>Total expenses</small><br><strong>${money(summary.expenses)}</strong></div><div style="padding:14px;background:#f8fafc;border-radius:12px"><small>Bills paid</small><br><strong>${money(summary.billsPaid)}</strong></div><div style="padding:14px;background:#f8fafc;border-radius:12px"><small>Bills outstanding</small><br><strong>${money(summary.billsOutstanding)}</strong></div></div><p style="margin-top:20px;color:#475569">Savings progress: <strong>${summary.savingsProgress}%</strong><br>Budget performance: <strong>${summary.budgetPerformance}% used</strong></p>`) };
}
