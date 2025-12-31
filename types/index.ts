/**
 * Shared type definitions for the Hoot app
 */

export interface Friend {
  id: string;
  friendId: string;
  friendUsername?: string;
  friendDisplayName?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  isIncoming?: boolean;
  isFavorite?: boolean;
  mutedUntil?: Date | null;
  streakCount?: number;
  lastHootDate?: string;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  createdBy: string;
  createdAt?: Date;
  isFavorite?: boolean;
  mutedUntil?: Date | null;
  streakCount?: number;
  lastHootDate?: string;
}

export interface GroupActivity {
  id: string;
  type: 'member_added' | 'member_removed' | 'group_created' | 'display_name_changed' | 'group_renamed';
  userId: string;
  username?: string;
  userDisplayName?: string;
  targetUserId?: string;
  targetUsername?: string;
  targetDisplayName?: string;
  targetUsernameOnly?: string;
  oldDisplayName?: string;
  newDisplayName?: string;
  oldGroupName?: string;
  newGroupName?: string;
  timestamp: Date;
}

