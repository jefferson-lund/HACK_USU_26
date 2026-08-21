import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Text from '@/components/ui/Text';
import { color, radius, space } from '@/constants/theme';
import type { ActivityImpact, RegressionResult } from '@/lib/analysis';

export type InsightListProps = {
  results: RegressionResult;
};

function correlationStrength(impact: ActivityImpact) {
  if (impact.impact.startsWith('strong')) return 'strongly';
  if (impact.impact.startsWith('moderate')) return 'moderately';
  return 'weakly';
}

function regressionCopy(impact: ActivityImpact) {
  const magnitude = Math.abs(impact.coefficient).toFixed(1);
  if (Math.abs(impact.coefficient) < 0.05) {
    return `On days you ${impact.activity}, your rating is about the same.`;
  }
  return `On days you ${impact.activity}, your rating is about ${magnitude} points ${
    impact.coefficient > 0 ? 'higher' : 'lower'
  }.`;
}

function correlationCopy(impact: ActivityImpact) {
  if (Math.abs(impact.coefficient) < 0.05) {
    return `${impact.activity} does not show a clear relationship with your ratings yet.`;
  }
  return `${impact.activity} tends to go together ${correlationStrength(impact)} with ${
    impact.coefficient > 0 ? 'higher' : 'lower'
  } ratings.`;
}

export function InsightList({ results }: InsightListProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <View style={styles.wrapper}>
      {results.impacts.map((impact) => (
        <Card key={impact.activity} padded={false} style={styles.insight}>
          <View
            style={[
              styles.marker,
              impact.coefficient < 0 ? styles.negativeMarker : styles.positiveMarker,
            ]}
          />
          <View style={styles.copy}>
            <Text variant="body" weight="medium">
              {results.method === 'multiple-regression'
                ? regressionCopy(impact)
                : correlationCopy(impact)}
            </Text>
            {showDetails ? (
              <Text variant="caption" tone="soft" numeric>
                {results.method === 'multiple-regression'
                  ? `${impact.coefficient >= 0 ? '+' : ''}${impact.coefficient.toFixed(2)} outcome points`
                  : `Pearson r ${impact.coefficient >= 0 ? '+' : ''}${impact.coefficient.toFixed(2)}`}
                {' · '}
                {impact.impact}
              </Text>
            ) : null}
          </View>
        </Card>
      ))}
      <Button variant="ghost" size="small" onPress={() => setShowDetails((current) => !current)}>
        {showDetails ? 'Hide details' : 'Show details'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space.sm,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  marker: {
    width: 5,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  positiveMarker: {
    backgroundColor: color.chartPositive,
  },
  negativeMarker: {
    backgroundColor: color.chartNegative,
  },
  copy: {
    flex: 1,
    gap: space.xxs,
    padding: space.md,
  },
});

export default InsightList;
