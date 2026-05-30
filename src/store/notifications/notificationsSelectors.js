export function selectUnreadCount(state) {
  let count = 0;
  for (let i = 0; i < state.notifications.length; i++) {
    if (!state.notifications[i].read) count++;
  }
  return count;
}
