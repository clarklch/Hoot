/**
 * Mute helper functions for checking mute status and formatting mute duration text
 */

interface MutableItem {
  mutedUntil?: Date | null;
}

/**
 * Checks if a friend is currently muted
 */
export function isFriendMuted(friend: MutableItem): boolean {
  if (!friend.mutedUntil) return false;
  return new Date(friend.mutedUntil) > new Date();
}

/**
 * Checks if a group is currently muted
 */
export function isGroupMuted(group: MutableItem): boolean {
  if (!group.mutedUntil) return false;
  return new Date(group.mutedUntil) > new Date();
}

/**
 * Gets formatted mute status text for a friend
 * Returns empty string if not muted, otherwise returns time remaining (e.g., "2h", "1d", "∞")
 */
export function getMuteStatusText(friend: MutableItem): string {
  if (!isFriendMuted(friend)) return '';
  const mutedUntil = new Date(friend.mutedUntil!);
  const now = new Date();

  // Check if it's an indefinite mute (more than 50 years away)
  const yearsRemaining = (mutedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (yearsRemaining > 50) {
    return '∞';
  }

  const hoursRemaining = Math.ceil((mutedUntil.getTime() - now.getTime()) / (1000 * 60 * 60));
  if (hoursRemaining < 1) {
    const minutesRemaining = Math.ceil((mutedUntil.getTime() - now.getTime()) / (1000 * 60));
    return `${minutesRemaining}m`;
  } else if (hoursRemaining < 24) {
    return `${hoursRemaining}h`;
  } else {
    const daysRemaining = Math.ceil(hoursRemaining / 24);
    return `${daysRemaining}d`;
  }
}

/**
 * Gets formatted mute status text for a group
 * Returns empty string if not muted, otherwise returns time remaining (e.g., "2h", "1d", "∞")
 */
export function getGroupMuteStatusText(group: MutableItem): string {
  if (!isGroupMuted(group)) return '';
  const mutedUntil = new Date(group.mutedUntil!);
  const now = new Date();

  const yearsRemaining = (mutedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (yearsRemaining > 50) {
    return '∞';
  }

  const hoursRemaining = Math.ceil((mutedUntil.getTime() - now.getTime()) / (1000 * 60 * 60));
  if (hoursRemaining < 1) {
    const minutesRemaining = Math.ceil((mutedUntil.getTime() - now.getTime()) / (1000 * 60));
    return `${minutesRemaining}m`;
  } else if (hoursRemaining < 24) {
    return `${hoursRemaining}h`;
  } else {
    const daysRemaining = Math.ceil(hoursRemaining / 24);
    return `${daysRemaining}d`;
  }
}

