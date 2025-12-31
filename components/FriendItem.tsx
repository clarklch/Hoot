import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { isFriendMuted, getMuteStatusText } from '@/utils/muteHelpers';
import { Friend } from '@/types';

interface FriendItemProps {
  friend: Friend;
  colors: {
    icon: string;
    tint: string;
    text: string;
  };
  styles: {
    friendItem: any;
    friendInfo: any;
    friendName: any;
    friendUsername: any;
    friendActions: any;
    streakText: any;
    favoriteButton: any;
    muteButton: any;
    muteStatusText: any;
    removeButton: any;
    removeButtonText: any;
  };
  onToggleFavorite: (friend: Friend) => void | Promise<void>;
  onMute: (friend: Friend) => void;
  onRemove: (friend: Friend) => void | Promise<void>;
}

// Type guard to ensure friend has required properties for FriendItem
function isValidFriend(friend: any): friend is Friend {
  return friend && typeof friend.id === 'string' && typeof friend.friendId === 'string';
}

export function FriendItem({
  friend,
  colors,
  styles: componentStyles,
  onToggleFavorite,
  onMute,
  onRemove,
}: FriendItemProps) {
  const isMuted = isFriendMuted(friend);

  return (
    <View style={[componentStyles.friendItem, { borderColor: colors.icon }]}>
      <View style={componentStyles.friendInfo}>
        <ThemedText style={componentStyles.friendName}>
          {friend.friendDisplayName || friend.friendUsername || 'Unknown'}
        </ThemedText>
        {friend.friendUsername && (
          <ThemedText style={componentStyles.friendUsername}>
            @{friend.friendUsername}
          </ThemedText>
        )}
      </View>
      <View style={componentStyles.friendActions}>
        {(friend.streakCount || 0) > 0 && (
          <ThemedText style={[componentStyles.streakText, { color: colors.tint, marginRight: 8 }]}>
            🔥 {(friend.streakCount || 0)}
          </ThemedText>
        )}
        <TouchableOpacity
          style={componentStyles.favoriteButton}
          onPress={() => onToggleFavorite(friend)}>
          <IconSymbol
            name={friend.isFavorite ? "heart.fill" : "heart"}
            size={24}
            color={friend.isFavorite ? colors.tint : colors.icon}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={componentStyles.muteButton}
          onPress={() => onMute(friend)}>
          <IconSymbol
            name={isMuted ? "bell.slash.fill" : "bell.slash"}
            size={24}
            color={isMuted ? '#ff9500' : colors.icon}
          />
          {isMuted && (
            <ThemedText style={componentStyles.muteStatusText}>
              {getMuteStatusText(friend)}
            </ThemedText>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[componentStyles.removeButton, { backgroundColor: '#ff4444' }]}
          onPress={() => onRemove(friend)}>
          <ThemedText style={componentStyles.removeButtonText}>Remove</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

