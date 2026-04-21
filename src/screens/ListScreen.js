import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BathroomCard from '../components/BathroomCard';

export default function ListScreen({ bathrooms, loading, onSelectBathroom }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return lowerSearch
      ? bathrooms.filter((b) => b.name.toLowerCase().includes(lowerSearch))
      : bathrooms;
  }, [bathrooms, search]);

  const renderItem = useCallback(({ item }) => (
    <BathroomCard bathroom={item} onPress={() => onSelectBathroom(item)} />
  ), [onSelectBathroom]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#767676" style={styles.searchIcon} accessibilityElementsHidden />
        <TextInput
          style={styles.searchInput}
          placeholder="Search restrooms..."
          placeholderTextColor="#767676"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          accessibilityLabel="Search restrooms"
          accessibilityHint="Type to filter the list of nearby restrooms"
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Searching nearby...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji} accessibilityElementsHidden>🚫🚽</Text>
          <Text style={styles.emptyTitle} accessibilityRole="header">No restrooms found</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'Try a different search term' : 'Try adjusting your filters or refreshing'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          accessibilityLabel={`${filtered.length} nearby restrooms`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f4ff' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: '#222' },
  list: { paddingBottom: 24, paddingTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#7C3AED', fontSize: 16, fontWeight: '600' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#444' },
});
