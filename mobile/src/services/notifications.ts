let unreadCount = 1;
export function getUnreadNotificationCount() { return unreadCount; }
export function markNotificationsRead() { unreadCount = 0; }
