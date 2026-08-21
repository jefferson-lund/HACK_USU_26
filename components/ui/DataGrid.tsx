import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { alpha, color, radius, space } from '@/constants/theme';
import Text from './Text';

export type DataGridColumn<Row> = {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render: (row: Row, index: number) => ReactNode;
};

export type DataGridProps<Row> = {
  columns: DataGridColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  emptyMessage?: string;
};

export function DataGrid<Row>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No data yet.',
}: DataGridProps<Row>) {
  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="small" tone="soft">
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={styles.table}>
        <View style={[styles.row, styles.header]}>
          {columns.map((column) => (
            <View
              key={column.key}
              style={[styles.cell, { width: column.width ?? 132 }]}>
              <Text variant="caption" weight="bold" tone="soft" align={column.align ?? 'left'}>
                {column.label}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row, rowIndex) => (
          <View key={getRowKey(row, rowIndex)} style={styles.row}>
            {columns.map((column) => (
              <View
                key={column.key}
                style={[styles.cell, { width: column.width ?? 132 }]}>
                <Text variant="small" align={column.align ?? 'left'}>
                  {column.render(row, rowIndex)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: alpha.divider80,
  },
  header: {
    backgroundColor: color.slateSurface,
  },
  cell: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
});

export default DataGrid;
