import { StyleSheet, View } from 'react-native';

import Card from '@/components/ui/Card';
import Text from '@/components/ui/Text';
import { color, radius, space } from '@/constants/theme';
import type { WeeklyPlan as WeeklyPlanData } from '@/lib/api/weeklyPlan';

export type WeeklyPlanProps = {
  plan: WeeklyPlanData;
};

export function WeeklyPlan({ plan }: WeeklyPlanProps) {
  return (
    <View style={styles.wrapper}>
      <Card tone="info" style={styles.overview}>
        <Text variant="body" weight="semibold">
          {plan.summary}
        </Text>
        {plan.rationale ? (
          <Text variant="small" tone="soft">
            {plan.rationale}
          </Text>
        ) : null}
        {plan.guidelines.length > 0 ? (
          <View style={styles.guidelines}>
            <Text variant="small" weight="bold">
              Keep in mind
            </Text>
            {plan.guidelines.map((guideline) => (
              <Text key={guideline} variant="small">
                • {guideline}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <View style={styles.days}>
        {plan.days.map((day) => (
          <Card key={day.day_index} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text variant="h2">{day.label}</Text>
              <Text variant="caption" tone="primary" weight="bold">
                {day.focus}
              </Text>
            </View>
            {day.activities.map((activity) => (
              <View key={activity.id} style={styles.activity}>
                <Text variant="small" weight="bold">
                  {activity.name}
                </Text>
                {activity.instructions ? (
                  <Text variant="small" tone="soft">
                    {activity.instructions}
                  </Text>
                ) : null}
                {activity.reason ? (
                  <Text variant="caption" tone="muted">
                    Why: {activity.reason}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space.md,
  },
  overview: {
    gap: space.sm,
  },
  guidelines: {
    gap: space.xxs,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
  },
  days: {
    gap: space.sm,
  },
  day: {
    gap: space.sm,
  },
  dayHeader: {
    gap: space.xxs,
  },
  activity: {
    gap: space.xxs,
    paddingLeft: space.sm,
    borderLeftWidth: 3,
    borderLeftColor: color.primary,
  },
});

export default WeeklyPlan;
