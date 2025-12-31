import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AdminScreen() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [usernameCount, setUsernameCount] = useState<number | null>(null);
  const [friendshipCount, setFriendshipCount] = useState<number | null>(null);
  const [groupCount, setGroupCount] = useState<number | null>(null);
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const fetchCounts = async () => {
    try {
      // Count users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setUserCount(usersSnapshot.size);

      // Count usernames
      const usernamesSnapshot = await getDocs(collection(db, 'usernames'));
      setUsernameCount(usernamesSnapshot.size);

      // Count friendships
      const friendshipsSnapshot = await getDocs(collection(db, 'friendships'));
      setFriendshipCount(friendshipsSnapshot.size);

      // Count groups
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      setGroupCount(groupsSnapshot.size);

      // Count messages
      const messagesSnapshot = await getDocs(collection(db, 'messages'));
      setMessageCount(messagesSnapshot.size);
    } catch (error) {
      console.error('Error fetching counts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCounts();
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Image 
          source={require('@/assets/images/hoot-emoji.png')} 
          style={styles.loadingEmoji}
          resizeMode="contain"
        />
        <ThemedText style={styles.loadingText}>Loading database stats...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Image 
              source={require('@/assets/images/hoot-emoji.png')} 
              style={styles.titleEmoji}
              resizeMode="contain"
            />
            <ThemedText type="title" style={styles.title}>
              Database Statistics
            </ThemedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.snow || '#fff', borderColor: colors.icon }]}>
            <ThemedText style={styles.statLabel}>Total Users</ThemedText>
            <ThemedText style={[styles.statValue, { color: colors.tint }]}>
              {userCount ?? 'N/A'}
            </ThemedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.snow || '#fff', borderColor: colors.icon }]}>
            <ThemedText style={styles.statLabel}>Usernames</ThemedText>
            <ThemedText style={[styles.statValue, { color: colors.tint }]}>
              {usernameCount ?? 'N/A'}
            </ThemedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.snow || '#fff', borderColor: colors.icon }]}>
            <ThemedText style={styles.statLabel}>Friendships</ThemedText>
            <ThemedText style={[styles.statValue, { color: colors.tint }]}>
              {friendshipCount ?? 'N/A'}
            </ThemedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.snow || '#fff', borderColor: colors.icon }]}>
            <ThemedText style={styles.statLabel}>Groups</ThemedText>
            <ThemedText style={[styles.statValue, { color: colors.tint }]}>
              {groupCount ?? 'N/A'}
            </ThemedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.snow || '#fff', borderColor: colors.icon }]}>
            <ThemedText style={styles.statLabel}>Messages</ThemedText>
            <ThemedText style={[styles.statValue, { color: colors.tint }]}>
              {messageCount ?? 'N/A'}
            </ThemedText>
          </View>

          <ThemedText style={styles.hint}>
            Pull down to refresh ❄️
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  titleEmoji: {
    width: 50,
    height: 50,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  loadingEmoji: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  statCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statLabel: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 8,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  hint: {
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.6,
    fontSize: 14,
  },
});

