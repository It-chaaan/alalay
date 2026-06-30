import { formatCurrency } from "../utils/formatters";

export const authCopy = {
  brandHeadline: "Ibigay ang kontrol sa iyong pera.",
  brandDescription:
    "Thousands of Filipinos are already managing their bills, tracking expenses, and hitting savings goals with a little help from their AI companion.",
  insightLabel: "Alalay AI insight",
  insightText: `You have ${formatCurrency(
    3699,
  )} in bills due this week. Set aside this amount from your salary to avoid late fees. Kaya mo yan!`,
  socialProof: "Join 42,000+ users managing their finances",
};

export const authStats = [
  { value: "72/100", label: "Health score" },
  { value: "48%", label: "Savings rate" },
  { value: "75%", label: "Bills on time" },
];
