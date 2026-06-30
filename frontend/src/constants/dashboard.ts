import { formatCurrency } from "../utils/formatters";

export const dashboardSummary = [
  {
    label: "Total bills",
    value: formatCurrency(4599),
    note: "4 bills ngayong buwan",
    icon: "receipt",
  },
  {
    label: "Due this week",
    value: formatCurrency(3699),
    note: "Meralco + PLDT",
    icon: "clock",
  },
  {
    label: "Monthly expenses",
    value: formatCurrency(14086),
    note: "16% vs last month",
    icon: "wallet",
  },
  {
    label: "Savings progress",
    value: "48%",
    note: `${formatCurrency(12000)} of ${formatCurrency(25000)}`,
    icon: "spark",
  },
];

export const financialHealth = {
  score: 72,
  metrics: [
    { label: "On-time bills", value: 75, color: "bg-brand-primary" },
    { label: "Savings rate", value: 48, color: "bg-sky-500" },
    { label: "Budget use", value: 82, color: "bg-amber-500" },
  ],
};

export const aiInsight = {
  body: `Ang iyong Meralco bill ay due ngayon - ${formatCurrency(
    2400,
  )}. Magbayad na para maiwasan ang late fee. Based on your spending, you can save an extra ${formatCurrency(
    1200,
  )} this week by cutting food delivery orders.`,
  cards: [
    {
      title: "Manila Water overdue",
      body: `${formatCurrency(350)} - 8 days past due. Bayaran na agad!`,
      tone: "warning",
    },
    {
      title: "Savings tip",
      body: `ChatGPT Plus (${formatCurrency(900)}/mo) - laging ginagamit mo?`,
      tone: "success",
    },
  ],
};

export const weeklyBills = [
  { initial: "M", name: "Meralco", amount: 2400, due: "Due Jun 28", status: "Due today", tone: "today" },
  { initial: "P", name: "PLDT Home Fiber", amount: 1299, due: "Due Jul 5", status: "Upcoming", tone: "upcoming" },
  { initial: "M", name: "Manila Water", amount: 350, due: "Due Jun 20", status: "Overdue", tone: "overdue" },
  { initial: "S", name: "SSS Contribution", amount: 550, due: "Due Jul 15", status: "Upcoming", tone: "upcoming" },
  { initial: "P", name: "PhilHealth", amount: 400, due: "Due Jul 10", status: "Upcoming", tone: "upcoming" },
  { initial: "P", name: "Pag-IBIG", amount: 200, due: "Due Jul 12", status: "Upcoming", tone: "upcoming" },
];

export const monthlySpending = [
  { month: "Nov", value: 11000 },
  { month: "Dec", value: 15500 },
  { month: "Jan", value: 12800 },
  { month: "Feb", value: 10700 },
  { month: "Mar", value: 13200 },
  { month: "Apr", value: 11800 },
  { month: "May", value: 12100 },
  { month: "Jun", value: 14100 },
];

export const recentActivity = [
  { initial: "S", merchant: "SM Supermarket", date: "Jun 27", amount: -1240, color: "bg-orange-500" },
  { initial: "G", merchant: "Grab", date: "Jun 27", amount: -89, color: "bg-sky-500" },
  { initial: "S", merchant: "Salary - BDO", date: "Jun 25", amount: 35000, color: "bg-green-700" },
  { initial: "M", merchant: "Mercury Drug", date: "Jun 24", amount: -420, color: "bg-purple-500" },
  { initial: "J", merchant: "Jollibee", date: "Jun 24", amount: -185, color: "bg-red-400" },
];

export const dashboardNav = [
  "Dashboard",
  "Bills",
  "Subscriptions",
  "Expenses",
  "Income",
  "Savings Goals",
  "Budget",
  "Reports",
  "AI Assistant",
  "OCR Scanner",
  "Settings",
];
