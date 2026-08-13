import React from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/Themed';
import { Brand } from '@/constants/Colors';

interface WhoopPanelProps {
  whoopToken: string;
  onChangeToken: (value: string) => void;
  isLoadingWhoop: boolean;
  onConnectWhoop: () => void;
  onFetchWhoopData: () => void;
}

// The "Whoop Integration" controls: paste-token field, Connect via OAuth
// button, and Fetch Whoop Data button. Rendered inside the Testing &
// Analytics section.
export default function WhoopPanel({
  whoopToken,
  onChangeToken,
  isLoadingWhoop,
  onConnectWhoop,
  onFetchWhoopData,
}: WhoopPanelProps) {
  return (
    <View style={styles.whoopSection}>
      <Text style={styles.sectionTitle}>Whoop Integration</Text>

      <TextInput
        style={styles.input}
        placeholder="Or paste access token here"
        placeholderTextColor={Brand.inkFaint}
        value={whoopToken}
        onChangeText={onChangeToken}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.testButton}
        onPress={onConnectWhoop}
      >
        <Text style={styles.testButtonText}>Connect via OAuth</Text>
      </TouchableOpacity>

      {whoopToken && (
        <TouchableOpacity
          style={[styles.testButton, isLoadingWhoop && styles.testButtonDisabled]}
          onPress={onFetchWhoopData}
          disabled={isLoadingWhoop}
        >
          <Text style={styles.testButtonText}>
            {isLoadingWhoop ? 'Fetching...' : 'Fetch Whoop Data'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface WhoopDataTableProps {
  whoopData: Array<{
    date: string;
    strain?: number;
    recoveryScore?: number;
    hrv?: number;
    sleepDuration?: number;
    sleepPerformance?: number;
  }>;
}

// The Whoop data table shown at the bottom of the screen, always visible
// (independent of the Testing & Analytics toggle) whenever Whoop data has
// been fetched.
export function WhoopDataTable({ whoopData }: WhoopDataTableProps) {
  if (whoopData.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Whoop Data</Text>
      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableHeader, styles.dateCell]}>Date</Text>
            <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Strain</Text>
            <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Recovery</Text>
            <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>HRV</Text>
            <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Sleep (hrs)</Text>
            <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Sleep %</Text>
          </View>
          {whoopData.slice(0, 10).map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.dateCell]}>{row.date}</Text>
              <Text style={[styles.tableCell, styles.activityCell]}>
                {row.strain?.toFixed(1) || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.activityCell]}>
                {row.recoveryScore || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.activityCell]}>
                {row.hrv?.toFixed(0) || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.activityCell]}>
                {row.sleepDuration?.toFixed(1) || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.activityCell]}>
                {row.sleepPerformance || '-'}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: Brand.ink,
  },
  whoopSection: {
    gap: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Brand.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: Brand.inputBackground,
    color: Brand.ink,
  },
  testButton: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: Brand.success,
    alignItems: 'center',
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  testButtonText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  // Note: `testButtonDisabled` is referenced above but intentionally left
  // undefined here, matching the original (unsplit) screen's behavior —
  // it was never defined there either, so the disabled state currently has
  // no visual effect. Not in scope to fix as part of this extraction.
  table: {
    minWidth: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    alignItems: 'center',
  },
  tableCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    textAlign: 'center',
    color: Brand.slateSoft,
  },
  dateCell: {
    width: 90,
    textAlign: 'left',
    fontWeight: '500',
  },
  activityCell: {
    width: 120,
    fontWeight: '500',
  },
  tableHeader: {
    fontWeight: '700',
    backgroundColor: Brand.slateBg,
    color: Brand.slateMed,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
