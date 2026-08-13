import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { Brand } from '@/constants/Colors';

interface DataTableProps {
  data: Array<{ date: string; activities: Record<string, boolean>; outcome: number }>;
}

export default function DataTable({ data }: DataTableProps) {
  if (data.length === 0) return null;

  return (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>Data Sample (Last 10 Days)</Text>
      <ScrollView horizontal>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableHeader, styles.dateCell]}>Date</Text>
            {Object.keys(data[0].activities).map(activity => (
              <Text key={activity} style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>
                {activity}
              </Text>
            ))}
            <Text style={[styles.tableCell, styles.tableHeader, styles.outcomeHeaderCell]}>Outcome</Text>
          </View>
          {data.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.dateCell]}>{row.date.slice(5)}</Text>
              {Object.keys(data[0].activities).map(activity => (
                <Text key={activity} style={[styles.tableCell, styles.activityCell]}>
                  {row.activities[activity] ? '1' : '0'}
                </Text>
              ))}
              <Text style={[styles.tableCell, styles.outcomeCell, styles.outcomeDataCell]}>
                {typeof row.outcome === 'number' ? row.outcome : 'N/A'}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tableContainer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    padding: 12,
    backgroundColor: Brand.white,
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: Brand.slateDark,
  },
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
  outcomeHeaderCell: {
    width: 100,
  },
  outcomeDataCell: {
    width: 100,
    fontWeight: '700',
    color: Brand.accentBlue,
    fontSize: 14,
  },
  tableHeader: {
    fontWeight: '700',
    backgroundColor: Brand.slateBg,
    color: Brand.slateMed,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  outcomeCell: {
    fontWeight: '700',
    color: Brand.accentBlue,
  },
});
