import { useApiQuery } from "./useApiQuery";

export type NotificationPreferences = {
  user_id: string;
  bill_reminders: boolean;
  bill_reminder_days: number;
  subscription_reminders: boolean;
  summaries: boolean;
  overspending_alerts: boolean;
  budget_thresholds: boolean;
  savings_milestones: boolean;
  login_alerts: boolean;
};

export function useNotificationPreferences() {
  return useApiQuery<NotificationPreferences>("/users/me/notification-preferences");
}
