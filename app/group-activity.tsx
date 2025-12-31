import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface GroupActivity {
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

export default function GroupActivityScreen() {
    const { groupId } = useLocalSearchParams<{ groupId?: string }>();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const [groupName, setGroupName] = useState<string>('Group');
    const [activities, setActivities] = useState<GroupActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState<GroupActivity | null>(null);

    useEffect(() => {
        if (!groupId || typeof groupId !== 'string') {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                // Load group name
                const groupDoc = await getDoc(doc(db, 'groups', groupId));
                if (groupDoc.exists()) {
                    const data = groupDoc.data() as any;
                    setGroupName(data.name || 'Group');
                }

                // Load activities
                const activitiesQuery = query(
                    collection(db, 'groupActivities'),
                    where('groupId', '==', groupId)
                );
                const snapshot = await getDocs(activitiesQuery);
                const loadedActivities: GroupActivity[] = snapshot.docs.map(docSnap => {
                    const data = docSnap.data() as any;
                    let timestamp = new Date();
                    if (data.timestamp) {
                        if (data.timestamp.toDate) {
                            timestamp = data.timestamp.toDate();
                        } else if (data.timestamp instanceof Date) {
                            timestamp = data.timestamp;
                        } else if (typeof data.timestamp === 'string') {
                            timestamp = new Date(data.timestamp);
                        }
                    }
                    return {
                        id: docSnap.id,
                        ...data,
                        timestamp,
                    } as GroupActivity;
                });

                // Sort newest first
                loadedActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                setActivities(loadedActivities);
            } catch (error) {
                console.error('Error loading group activity screen:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [groupId]);

    const handleBack = () => {
        // Behave like the native back gesture: go to the previous screen in the stack
        router.back();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with safe area - covers Dynamic Island/notch */}
            <View style={[styles.headerContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={colors.text} />
                        <ThemedText style={styles.backButtonText}>Back</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.title} numberOfLines={1}>
                        {groupName} - Activity
                    </ThemedText>
                    <View style={{ width: 80 }} />
                </View>
            </View>

            <View style={{ height: insets.top + 60 }} />
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <ThemedText style={styles.loadingText}>Loading activity...</ThemedText>
                </View>
            ) : activities.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <ThemedText style={styles.emptyText}>No activity yet ❄️</ThemedText>
                </View>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {activities.map((activity) => (
                        <TouchableOpacity
                            key={activity.id}
                            style={[styles.activityItem, { borderColor: colors.icon }]}
                            onPress={() => setSelectedActivity(activity)}>
                            <ThemedText style={styles.activityText}>
                                {activity.type === 'group_created' && (
                                    <>Group created by {activity.userDisplayName || activity.username || 'Unknown'}</>
                                )}
                                {activity.type === 'member_added' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} added {activity.targetDisplayName || activity.targetUsername || 'Unknown'}</>
                                )}
                                {activity.type === 'member_removed' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} removed {activity.targetDisplayName || activity.targetUsername || 'Unknown'}</>
                                )}
                                {activity.type === 'display_name_changed' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} changed their name from "{activity.oldDisplayName || 'Unknown'}" to "{activity.newDisplayName || 'Unknown'}"</>
                                )}
                                {activity.type === 'group_renamed' && (
                                    <>{activity.userDisplayName || activity.username || 'Unknown'} renamed the group from "{activity.oldGroupName || 'Unknown'}" to "{activity.newGroupName || 'Unknown'}"</>
                                )}
                            </ThemedText>
                            <ThemedText style={styles.activityTimestamp}>
                                {activity.timestamp.toLocaleDateString()}{' '}
                                {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Activity Details Modal */}
            <Modal
                visible={selectedActivity !== null}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedActivity(null)}>
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        {selectedActivity && (
                            <>
                                <ThemedText style={styles.modalTitle}>Activity Details</ThemedText>

                                <View style={styles.activityDetailSection}>
                                    <ThemedText style={styles.activityDetailLabel}>User:</ThemedText>
                                    <ThemedText style={styles.activityDetailValue}>
                                        {selectedActivity.userDisplayName || 'Unknown'}
                                        {selectedActivity.username && ` (@${selectedActivity.username})`}
                                    </ThemedText>
                                </View>

                                {selectedActivity.targetUserId && (
                                    <View style={styles.activityDetailSection}>
                                        <ThemedText style={styles.activityDetailLabel}>
                                            {selectedActivity.type === 'member_added' || selectedActivity.type === 'member_removed' ? 'Target User:' : 'User:'}
                                        </ThemedText>
                                        <ThemedText style={styles.activityDetailValue}>
                                            {selectedActivity.targetDisplayName || selectedActivity.targetUsername || 'Unknown'}
                                            {selectedActivity.targetUsername && ` (@${selectedActivity.targetUsername})`}
                                            {selectedActivity.targetUsernameOnly && !selectedActivity.targetUsername && ` (@${selectedActivity.targetUsernameOnly})`}
                                        </ThemedText>
                                    </View>
                                )}

                                <View style={styles.activityDetailSection}>
                                    <ThemedText style={styles.activityDetailLabel}>Activity:</ThemedText>
                                    <ThemedText style={styles.activityDetailValue}>
                                        {selectedActivity.type === 'group_created' && 'Group created'}
                                        {selectedActivity.type === 'member_added' && 'Member added'}
                                        {selectedActivity.type === 'member_removed' && 'Member removed'}
                                        {selectedActivity.type === 'display_name_changed' && 'Display name changed'}
                                        {selectedActivity.type === 'group_renamed' && 'Group renamed'}
                                    </ThemedText>
                                </View>

                                {selectedActivity.type === 'display_name_changed' && (
                                    <View style={styles.activityDetailSection}>
                                        <ThemedText style={styles.activityDetailLabel}>Name Change:</ThemedText>
                                        <ThemedText style={styles.activityDetailValue}>
                                            "{selectedActivity.oldDisplayName || 'Unknown'}" → "{selectedActivity.newDisplayName || 'Unknown'}"
                                        </ThemedText>
                                    </View>
                                )}

                                {selectedActivity.type === 'group_renamed' && (
                                    <View style={styles.activityDetailSection}>
                                        <ThemedText style={styles.activityDetailLabel}>Group Name Change:</ThemedText>
                                        <ThemedText style={styles.activityDetailValue}>
                                            "{selectedActivity.oldGroupName || 'Unknown'}" → "{selectedActivity.newGroupName || 'Unknown'}"
                                        </ThemedText>
                                    </View>
                                )}

                                <View style={styles.activityDetailSection}>
                                    <ThemedText style={styles.activityDetailLabel}>Date & Time:</ThemedText>
                                    <ThemedText style={styles.activityDetailValue}>
                                        {selectedActivity.timestamp.toLocaleDateString()} {selectedActivity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </ThemedText>
                                </View>

                                <TouchableOpacity
                                    style={[styles.modalCloseButton, { borderColor: colors.icon, marginTop: 20 }]}
                                    onPress={() => setSelectedActivity(null)}>
                                    <ThemedText style={[styles.modalCloseText, { color: colors.icon }]}>
                                        Close
                                    </ThemedText>
                                </TouchableOpacity>
                            </>
                        )}
                    </ThemedView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        width: '100%',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        opacity: 0.6,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        opacity: 0.6,
    },
    activityItem: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
    },
    activityText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
        lineHeight: 18,
    },
    activityTimestamp: {
        fontSize: 11,
        opacity: 0.6,
        color: '#000',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 20,
        color: '#000',
        textAlign: 'center',
    },
    activityDetailSection: {
        marginBottom: 16,
    },
    activityDetailLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#000',
        marginBottom: 4,
    },
    activityDetailValue: {
        fontSize: 15,
        color: '#000',
        lineHeight: 22,
    },
    modalCloseButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    modalCloseText: {
        fontSize: 16,
        fontWeight: '700',
    },
});


