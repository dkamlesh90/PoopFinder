import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export default function LocationPickerModal({ visible, currentName, onSelect, onUseGPS, onClose }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef             = useRef(null);

  const search = useCallback(async (text) => {
    if (!text.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    try {
      const url = `${NOMINATIM}?q=${encodeURIComponent(text)}&format=json&limit=7&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'PoopFinder/1.0' },
      });
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const onChangeText = useCallback((text) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 500);
  }, [search]);

  const clearState = useCallback(() => {
    setQuery('');
    setResults([]);
    setSearched(false);
  }, []);

  const handleSelect = useCallback((item) => {
    Keyboard.dismiss();
    const name = item.display_name.split(',').slice(0, 2).join(',').trim();
    onSelect({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      name,
    });
    clearState();
  }, [onSelect, clearState]);

  const handleUseGPS = useCallback(() => {
    clearState();
    onUseGPS();
  }, [onUseGPS, clearState]);

  const handleClose = useCallback(() => {
    clearState();
    onClose();
  }, [onClose, clearState]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} accessibilityElementsHidden />

          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">Choose Location</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close location picker"
            >
              <Ionicons name="close" size={22} color="#444" />
            </TouchableOpacity>
          </View>

          {currentName && (
            <View style={styles.currentRow}>
              <Ionicons name="location" size={14} color="#7C3AED" />
              <Text style={styles.currentText} numberOfLines={1}>Currently: {currentName}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.gpsBtn}
            onPress={handleUseGPS}
            accessibilityRole="button"
            accessibilityLabel="Use my current GPS location"
          >
            <Ionicons name="navigate" size={18} color="#7C3AED" />
            <Text style={styles.gpsBtnText}>Use My Current Location</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or search a city / address</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="New York, Chicago, 5th Ave…"
              placeholderTextColor="#bbb"
              value={query}
              onChangeText={onChangeText}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => search(query)}
              accessibilityLabel="Search for a location"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => { setQuery(''); setResults([]); setSearched(false); }}
                accessibilityLabel="Clear search"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#bbb" />
              </TouchableOpacity>
            )}
          </View>

          {searching && (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text style={styles.searchingText}>Searching…</Text>
            </View>
          )}

          {!searching && searched && results.length === 0 && (
            <View style={styles.centerRow}>
              <Text style={styles.noResults}>No results found. Try a different search.</Text>
            </View>
          )}

          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id.toString()}
            keyboardShouldPersistTaps="handled"
            style={styles.resultsList}
            renderItem={({ item }) => {
              const parts = item.display_name.split(',');
              const primary = parts.slice(0, 2).join(',').trim();
              const secondary = parts.slice(2, 4).join(',').trim();
              return (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => handleSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${primary}`}
                >
                  <Ionicons name="location-outline" size={18} color="#7C3AED" style={styles.resultIcon} />
                  <View style={styles.resultText}>
                    <Text style={styles.resultPrimary} numberOfLines={1}>{primary}</Text>
                    {secondary ? <Text style={styles.resultSecondary} numberOfLines={1}>{secondary}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#222' },
  closeBtn: { padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  currentText: { fontSize: 12, color: '#7C3AED', fontWeight: '500', flex: 1 },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f3eeff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e0d0ff',
    minHeight: 44,
  },
  gpsBtnText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 14,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerLabel: { fontSize: 12, color: '#aaa', fontWeight: '500' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: '#f8f4ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e8ddff',
    minHeight: 44,
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    paddingVertical: 10,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  searchingText: { fontSize: 13, color: '#7C3AED' },
  noResults: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  resultsList: { marginTop: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ff',
    gap: 12,
    minHeight: 52,
  },
  resultIcon: { flexShrink: 0 },
  resultText: { flex: 1 },
  resultPrimary: { fontSize: 14, fontWeight: '600', color: '#222' },
  resultSecondary: { fontSize: 12, color: '#888', marginTop: 2 },
});
