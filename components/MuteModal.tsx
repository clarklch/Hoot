import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isFriendMuted, isGroupMuted } from '@/utils/muteHelpers';

interface Friend {
  id: string;
  friendId: string;
  friendUsername?: string;
  friendDisplayName?: string;
  mutedUntil?: Date | null;
}

interface Group {
  id: string;
  name: string;
  mutedUntil?: Date | null;
}

interface MuteModalProps {
  visible: boolean;
  onClose: () => void;
  selectedFriend: Friend | null;
  selectedGroup: Group | null;
  isMutingGroup: boolean;
  customMuteHours: string;
  onCustomMuteHoursChange: (hours: string) => void;
  onMuteDuration: (durationHours: number | null, indefinite?: boolean) => void;
  onCustomMute: () => void;
}

export function MuteModal({
  visible,
  onClose,
  selectedFriend,
  selectedGroup,
  isMutingGroup,
  customMuteHours,
  onCustomMuteHoursChange,
  onMuteDuration,
  onCustomMute,
}: MuteModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const isCurrentlyMuted = isMutingGroup
    ? (selectedGroup && isGroupMuted(selectedGroup))
    : (selectedFriend && isFriendMuted(selectedFriend));

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
          <ThemedText style={styles.modalTitle}>
            {isMutingGroup && selectedGroup
              ? `Mute ${selectedGroup.name}`
              : selectedFriend
                ? `Mute ${selectedFriend.friendDisplayName || selectedFriend.friendUsername || 'Friend'}`
                : 'Mute'}
          </ThemedText>
          <ThemedText style={styles.modalDescription}>
            {isMutingGroup
              ? 'You won\'t receive hoots from this group during the mute period'
              : 'You won\'t receive hoots from this friend during the mute period'}
          </ThemedText>

          <TouchableOpacity
            style={[styles.muteOptionButton, { borderColor: colors.icon }]}
            onPress={() => onMuteDuration(1)}>
            <ThemedText style={styles.muteOptionText}>1 Hour</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.muteOptionButton, { borderColor: colors.icon }]}
            onPress={() => onMuteDuration(24)}>
            <ThemedText style={styles.muteOptionText}>1 Day</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.muteOptionButton, { borderColor: colors.icon }]}
            onPress={() => onMuteDuration(null, true)}>
            <ThemedText style={styles.muteOptionText}>Indefinitely</ThemedText>
          </TouchableOpacity>

          <View style={styles.customMuteContainer}>
            <ThemedText style={styles.customMuteLabel}>Custom Duration (hours):</ThemedText>
            <TextInput
              style={[styles.customMuteInput, { borderColor: colors.icon, color: '#000' }]}
              value={customMuteHours}
              onChangeText={onCustomMuteHoursChange}
              keyboardType="numeric"
              placeholder="24"
              placeholderTextColor={colors.icon}
            />
            <TouchableOpacity
              style={[styles.customMuteButton, { backgroundColor: colors.tint }]}
              onPress={onCustomMute}>
              <ThemedText style={styles.customMuteButtonText}>Apply</ThemedText>
            </TouchableOpacity>
          </View>

          {isCurrentlyMuted && (
            <TouchableOpacity
              style={[styles.unmuteButton, { borderColor: '#ff4444' }]}
              onPress={() => onMuteDuration(null)}>
              <ThemedText style={[styles.unmuteButtonText, { color: '#ff4444' }]}>
                Unmute
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.modalCancelButton, { borderColor: colors.icon }]}
            onPress={onClose}>
            <ThemedText style={[styles.modalCancelText, { color: colors.icon }]}>
              Cancel
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
  },
  modalDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
    color: '#000',
  },
  muteOptionButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    alignItems: 'center',
  },
  muteOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  customMuteContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  customMuteLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  customMuteInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  customMuteButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  customMuteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  unmuteButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    alignItems: 'center',
  },
  unmuteButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

