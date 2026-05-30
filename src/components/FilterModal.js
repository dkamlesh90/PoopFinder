import React, { useState, useEffect, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const DEFAULT_FILTERS = {
  maxDistanceMi: 5,
  freeOnly: false,
  accessibleOnly: false,
  changingTable: false,
  open24h: false,
  minRating: 0,
  useKm: false,
};

export function countActiveFilters(filters) {
  let n = 0;
  if (filters.maxDistanceMi !== DEFAULT_FILTERS.maxDistanceMi) n++;
  if (filters.freeOnly)       n++;
  if (filters.accessibleOnly) n++;
  if (filters.changingTable)  n++;
  if (filters.open24h)        n++;
  if (filters.minRating > 0)  n++;
  if (filters.useKm)          n++;
  return n;
}

export function applyFilters(bathrooms, filters) {
  const maxM = filters.maxDistanceMi * 1609.344;
  return bathrooms.filter((b) => {
    if (b.distance > maxM)                  return false;
    if (filters.freeOnly && b.fee)          return false;
    if (filters.accessibleOnly && !b.accessible) return false;
    if (filters.changingTable && !b.changingTable) return false;
    if (filters.open24h && b.openingHours !== '24/7') return false;
    if (filters.minRating > 0 && b.rating < filters.minRating) return false;
    return true;
  });
}

// Distance options in miles; km labels are shown when useKm is active.
// Values are always stored in miles internally; converted for display only.
const DISTANCE_OPTIONS = [
  { labelMi: '0.1 mi',  labelKm: '0.2 km', value: 0.1  },
  { labelMi: '0.25 mi', labelKm: '0.4 km', value: 0.25 },
  { labelMi: '0.5 mi',  labelKm: '0.8 km', value: 0.5  },
  { labelMi: '1 mi',    labelKm: '1.6 km', value: 1    },
  { labelMi: '2 mi',    labelKm: '3.2 km', value: 2    },
  { labelMi: '3 mi',    labelKm: '5 km',   value: 3    },
  { labelMi: '5 mi',    labelKm: '8 km',   value: 5    },
  { labelMi: '10 mi',   labelKm: '16 km',  value: 10   },
  { labelMi: '25 mi',   labelKm: '40 km',  value: 25   },
];

const RATING_OPTIONS = [
  { label: 'Any',  value: 0 },
  { label: '3+',   value: 3 },
  { label: '4+',   value: 4 },
  { label: '5 ★',  value: 5 },
];

export default function FilterModal({ visible, filters, onApply, onClose }) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (visible) setLocal(filters);
  }, [visible, filters]);

  const toggle = useCallback((key) => {
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleFreeOnly       = useCallback(() => toggle('freeOnly'),       [toggle]);
  const toggleAccessibleOnly = useCallback(() => toggle('accessibleOnly'), [toggle]);
  const toggleChangingTable  = useCallback(() => toggle('changingTable'),  [toggle]);
  const toggleOpen24h        = useCallback(() => toggle('open24h'),        [toggle]);

  const activeCount = countActiveFilters(local);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close filters"
      />

      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setLocal(DEFAULT_FILTERS)}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={styles.clearBtn}>Clear all</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          >
            <Ionicons name="close" size={22} color="#444" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Distance unit toggle */}
          <Text style={styles.sectionLabel}>Distance Unit</Text>
          <View style={styles.unitRow}>
            {[{ label: 'Miles', km: false }, { label: 'Kilometres', km: true }].map((opt) => {
              const active = local.useKm === opt.km;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.unitBtn, active && styles.unitBtnActive]}
                  onPress={() => setLocal((p) => ({ ...p, useKm: opt.km }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={[styles.unitBtnText, active && styles.unitBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Distance */}
          <Text style={styles.sectionLabel}>Max Distance</Text>
          <View style={styles.chipRow}>
            {DISTANCE_OPTIONS.map((opt) => {
              const active = local.maxDistanceMi === opt.value;
              const label = local.useKm ? opt.labelKm : opt.labelMi;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setLocal((p) => ({ ...p, maxDistanceMi: opt.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Features */}
          <Text style={styles.sectionLabel}>Features</Text>
          <ToggleRow
            icon="cash-outline"
            label="Free entry"
            value={local.freeOnly}
            onToggle={toggleFreeOnly}
          />
          <ToggleRow
            icon="accessibility"
            label="Wheelchair accessible"
            value={local.accessibleOnly}
            onToggle={toggleAccessibleOnly}
          />
          <ToggleRow
            icon="person"
            label="Baby changing table"
            value={local.changingTable}
            onToggle={toggleChangingTable}
          />
          <ToggleRow
            icon="time-outline"
            label="Open 24/7"
            value={local.open24h}
            onToggle={toggleOpen24h}
          />

          {/* Min rating */}
          <Text style={styles.sectionLabel}>Minimum Rating</Text>
          <View style={styles.chipRow}>
            {RATING_OPTIONS.map((opt) => {
              const active = local.minRating === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setLocal((p) => ({ ...p, minRating: opt.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Minimum rating ${opt.label}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Apply */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => onApply(local)}
            accessibilityRole="button"
            accessibilityLabel={`Apply ${activeCount} filter${activeCount !== 1 ? 's' : ''}`}
          >
            <Text style={styles.applyText}>
              {activeCount > 0 ? `Apply (${activeCount} active)` : 'Apply'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ToggleRow = memo(function ToggleRow({ icon, label, value, onToggle }) {
  return (
    <TouchableOpacity
      style={styles.toggleRow}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.toggleLeft}>
        <View style={[styles.toggleIcon, value && styles.toggleIconActive]}>
          <Ionicons name={icon} size={16} color={value ? '#fff' : '#7C3AED'} />
        </View>
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <View style={[styles.track, value && styles.trackActive]}>
        <View style={[styles.thumb, value && styles.thumbActive]} />
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8ff',
  },
  title: { fontSize: 17, fontWeight: '800', color: '#222' },
  clearBtn: { fontSize: 14, color: '#7C3AED', fontWeight: '600' },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0d5ff',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  unitBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  unitBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  unitBtnTextActive: { color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e0d5ff',
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  chipTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ff',
    minHeight: 44,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f3efff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIconActive: { backgroundColor: '#7C3AED' },
  toggleLabel: { fontSize: 15, color: '#222', fontWeight: '500' },
  track: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e0d5ff',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackActive: { backgroundColor: '#7C3AED' },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbActive: { alignSelf: 'flex-end' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  applyBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
