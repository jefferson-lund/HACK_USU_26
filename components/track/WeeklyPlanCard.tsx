import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { Brand } from '@/constants/Colors';
import type { WeeklyPlan } from '@/lib/api/weeklyPlan';

interface WeeklyPlanCardProps {
  plan: WeeklyPlan;
}

// The "Your 1-Week Plan" rendering block.
export default function WeeklyPlanCard({ plan }: WeeklyPlanCardProps) {
  if (!plan || !plan.days) return null;

  return (
    <View style={styles.planContainer}>
      <Text style={styles.planTitle}>Your 1-Week Plan</Text>
      <Text style={styles.planSummary}>{plan.summary || ''}</Text>
      {plan.rationale ? (
        <Text style={styles.planRationale}>{plan.rationale}</Text>
      ) : null}
      {plan.guidelines && plan.guidelines.length > 0 && (
        <View style={styles.guidelinesBox}>
          <Text style={styles.guidelinesTitle}>Guidelines</Text>
          {plan.guidelines.map((g, i) => (
            <Text key={i} style={styles.guidelineItem}>• {g}</Text>
          ))}
        </View>
      )}
      {plan.days.map((day) => (
        <View key={day.day_index} style={styles.dayCard}>
          <Text style={styles.dayLabel}>{day.label || ''}</Text>
          <Text style={styles.dayFocus}>{day.focus || ''}</Text>
          {day.activities && day.activities.map((act) => (
            <View key={act.id} style={styles.activityItem}>
              <Text style={styles.activityName}>{act.name || ''}</Text>
              {act.instructions ? (
                <Text style={styles.activityInstructions}>{act.instructions}</Text>
              ) : null}
              {act.reason ? (
                <Text style={styles.activityReason}>{act.reason}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  planContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(236, 253, 245, 0.6)',
    gap: 12,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.successDark,
  },
  planSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: Brand.successText,
  },
  planRationale: {
    fontSize: 13,
    lineHeight: 20,
    color: Brand.success,
    opacity: 0.9,
  },
  guidelinesBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    gap: 4,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.successDark,
    marginBottom: 4,
  },
  guidelineItem: {
    fontSize: 13,
    lineHeight: 20,
    color: Brand.successText,
  },
  dayCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    gap: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.successDark,
  },
  dayFocus: {
    fontSize: 13,
    color: Brand.success,
    fontStyle: 'italic',
  },
  activityItem: {
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(16, 185, 129, 0.4)',
    gap: 4,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.slateMed,
  },
  activityInstructions: {
    fontSize: 13,
    lineHeight: 18,
    color: Brand.slateFaint,
  },
  activityReason: {
    fontSize: 12,
    color: Brand.slateFainter,
    fontStyle: 'italic',
  },
});
