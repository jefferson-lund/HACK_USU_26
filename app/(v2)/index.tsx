import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import Button from '@/components/ui/Button';
import Callout from '@/components/ui/Callout';
import Card from '@/components/ui/Card';
import Field from '@/components/ui/Field';
import Pill from '@/components/ui/Pill';
import Text from '@/components/ui/Text';
import Wordmark from '@/components/v2/Wordmark';
import { color, layout, radius, space } from '@/constants/theme';
import { getSetup, initDatabase, saveSetup } from '@/lib/database';
import { generateHypothesis } from '@/lib/llm';

const HYPOTHESIS_DEBOUNCE_MS = 600;
const OUTCOME_EXAMPLES = ['more energy', 'better sleep', 'feel less anxious'];
const ACTIVITY_STARTERS = ['morning walk', 'exercise', 'no caffeine after 2pm', 'meditate'];

type Phase = 'loading' | 'form' | 'summary';
type Step = 'outcome' | 'activities' | 'review';

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'outcome', label: 'Outcome' },
  { key: 'activities', label: 'Activities' },
  { key: 'review', label: 'Review' },
];

function normalizeActivity(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function Progress({
  step,
  onStepPress,
}: {
  step: Step;
  onStepPress: (step: Step) => void;
}) {
  const activeIndex = STEPS.findIndex((item) => item.key === step);

  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel="Setup progress"
      accessibilityValue={{ min: 1, max: STEPS.length, now: activeIndex + 1 }}>
      <View style={styles.progressBars}>
        {STEPS.map((item, index) => (
          <Pressable
            key={item.key}
            disabled={index >= activeIndex}
            onPress={() => onStepPress(item.key)}
            accessibilityRole={index < activeIndex ? 'button' : undefined}
            accessibilityLabel={`${item.label}, step ${index + 1} of ${STEPS.length}`}
            style={styles.progressTarget}>
            <View
              style={[
                styles.progressBar,
                index <= activeIndex && styles.progressBarActive,
              ]}
            />
          </Pressable>
        ))}
      </View>
      <Text variant="caption" tone="soft" align="center">
        Step {activeIndex + 1} of {STEPS.length} · {STEPS[activeIndex].label}
      </Text>
    </View>
  );
}

function ActivityCloud({
  activities,
  onRemove,
}: {
  activities: string[];
  onRemove?: (activity: string) => void;
}) {
  return (
    <View style={styles.chipCloud}>
      {activities.map((activity) => (
        <Pill
          key={activity}
          removable={Boolean(onRemove)}
          accessibilityLabel={onRemove ? `Remove ${activity}` : activity}
          onPress={onRemove ? () => onRemove(activity) : undefined}>
          {activity}
        </Pill>
      ))}
    </View>
  );
}

export default function TodaySetupScreen() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [step, setStep] = useState<Step>('outcome');
  const [outcome, setOutcome] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [hasSavedSetup, setHasSavedSetup] = useState(false);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [activityFeedback, setActivityFeedback] = useState<string | null>(null);
  const [hypothesis, setHypothesis] = useState('');
  const [hypothesisFromAI, setHypothesisFromAI] = useState(false);
  const [hypothesisLoading, setHypothesisLoading] = useState(false);
  const [hypothesisError, setHypothesisError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hypothesisGenRef = useRef(0);

  useEffect(() => {
    const loadSetup = async () => {
      try {
        await initDatabase();
        const setup = await getSetup();
        if (setup) {
          setOutcome(setup.outcome);
          setActivities(setup.activities);
          setHasSavedSetup(true);
          setPhase('summary');
        } else {
          setPhase('form');
        }
      } catch (error) {
        console.error('Failed to load setup:', error);
        setPhase('form');
        setSaveError('Could not load your saved setup. You can still create a new one.');
      }
    };
    void loadSetup();
  }, []);

  const fetchHypothesis = useCallback(async (outcomeText: string, activityList: string[]) => {
    if (!outcomeText.trim() || activityList.length === 0) {
      hypothesisGenRef.current += 1;
      setHypothesis('');
      setHypothesisFromAI(false);
      setHypothesisError(null);
      setHypothesisLoading(false);
      return;
    }

    const generation = ++hypothesisGenRef.current;
    setHypothesisLoading(true);
    setHypothesisError(null);
    try {
      const result = await generateHypothesis(outcomeText.trim(), activityList);
      if (generation !== hypothesisGenRef.current) return;
      setHypothesis(result.hypothesis);
      setHypothesisFromAI(!result.usedFallback);
    } catch (error) {
      if (generation !== hypothesisGenRef.current) return;
      console.error('Failed to generate hypothesis:', error);
      setHypothesis('');
      setHypothesisFromAI(false);
      setHypothesisError(
        'Could not draft a hypothesis right now. You can still save your setup.',
      );
    } finally {
      if (generation === hypothesisGenRef.current) setHypothesisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!outcome.trim() || activities.length === 0) {
      hypothesisGenRef.current += 1;
      setHypothesis('');
      setHypothesisFromAI(false);
      setHypothesisError(null);
      setHypothesisLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void fetchHypothesis(outcome, activities);
    }, HYPOTHESIS_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activities, fetchHypothesis, outcome]);

  const addActivities = (values: string[]) => {
    const normalized = values.map(normalizeActivity).filter(Boolean);
    if (normalized.length === 0) {
      setActivityFeedback('Enter an activity before adding it.');
      return;
    }

    const existing = new Set(activities.map((item) => normalizeActivity(item).toLocaleLowerCase()));
    const additions: string[] = [];
    let duplicateCount = 0;

    for (const item of normalized) {
      const key = item.toLocaleLowerCase();
      if (existing.has(key)) {
        duplicateCount += 1;
      } else {
        existing.add(key);
        additions.push(item);
      }
    }

    if (additions.length > 0) setActivities((current) => [...current, ...additions]);
    setNewActivity('');
    setActivityFeedback(
      duplicateCount > 0
        ? `${duplicateCount === 1 ? 'That activity is' : 'Some activities are'} already in your list.`
        : null,
    );
  };

  const handleAddActivity = () => addActivities(newActivity.split(','));

  const removeActivity = (activity: string) => {
    setActivities((current) => current.filter((item) => item !== activity));
    setActivityFeedback(null);
  };

  const goFromOutcome = () => {
    if (!outcome.trim()) {
      setOutcomeError('Describe the result you want to improve.');
      return;
    }
    setOutcomeError(null);
    setStep('activities');
  };

  const goFromActivities = () => {
    if (activities.length === 0) {
      setActivityFeedback('Add at least one activity to test.');
      return;
    }
    setActivityFeedback(null);
    setStep('review');
  };

  const canSave = outcome.trim().length > 0 && activities.length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveSetup(outcome.trim(), activities);
      setOutcome(outcome.trim());
      setHasSavedSetup(true);
      setPhase('summary');
    } catch (error) {
      console.error('Failed to save setup:', error);
      setSaveError('Could not save your setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelReview = () => {
    if (hasSavedSetup) {
      setPhase('summary');
    } else {
      setStep('activities');
    }
    setSaveError(null);
  };

  const content = (() => {
    if (phase === 'loading') {
      return (
        <View style={styles.content}>
          <Wordmark />
          <View style={styles.skeletonHeading} />
          <Card>
            <View style={styles.skeletonCard}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLine} />
              <View style={styles.skeletonField} />
            </View>
          </Card>
        </View>
      );
    }

    if (phase === 'summary') {
      return (
        <View style={styles.content}>
          <Wordmark />
          <View style={styles.pageHeading}>
            <Text variant="h1">Your experiment</Text>
            <Text variant="body" tone="soft">
              Your daily check-in is ready. Adjust the setup whenever your focus changes.
            </Text>
          </View>

          {saveError ? <Callout tone="danger">{saveError}</Callout> : null}

          <Card style={styles.summaryCard}>
            <View style={styles.summaryBlock}>
              <Text variant="caption" tone="soft" weight="bold">
                OUTCOME
              </Text>
              <Text variant="h2">{outcome}</Text>
            </View>
            <View style={styles.summaryBlock}>
              <Text variant="caption" tone="soft" weight="bold">
                YOUR HYPOTHESIS
              </Text>
              <Card tone="info" busy={hypothesisLoading}>
                <Text variant="body" weight="medium">
                  {hypothesis || 'Your hypothesis will appear here once it is ready.'}
                </Text>
                {!hypothesisLoading && hypothesis ? (
                  <Text variant="caption" tone={hypothesisFromAI ? 'primary' : 'soft'}>
                    {hypothesisFromAI ? 'AI generated' : 'Template'}
                  </Text>
                ) : null}
              </Card>
              {hypothesisError ? <Callout tone="danger">{hypothesisError}</Callout> : null}
            </View>
            <View style={styles.summaryBlock}>
              <Text variant="caption" tone="soft" weight="bold">
                ACTIVITIES
              </Text>
              <ActivityCloud activities={activities} />
            </View>
          </Card>

          <View style={styles.actions}>
            <Button
              variant="secondary"
              onPress={() => {
                setStep('review');
                setPhase('form');
              }}>
              Edit setup
            </Button>
            <Button
              variant="ghost"
              loading={hypothesisLoading}
              onPress={() => void fetchHypothesis(outcome, activities)}>
              Regenerate hypothesis
            </Button>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <Wordmark />
        <Progress step={step} onStepPress={setStep} />

        {step === 'outcome' ? (
          <View style={styles.stepContent}>
            <View style={styles.pageHeading}>
              <Text variant="h1">What do you want to improve?</Text>
              <Text variant="body" tone="soft">
                Choose one outcome you can rate each day. Specific and personal works best.
              </Text>
            </View>
            <Field
              label="Your outcome"
              value={outcome}
              onChangeText={(value) => {
                setOutcome(value);
                if (value.trim()) setOutcomeError(null);
              }}
              placeholder="I want to…"
              error={outcomeError}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={goFromOutcome}
            />
            <View style={styles.suggestions}>
              <Text variant="small" tone="soft">
                Try an example
              </Text>
              <View style={styles.chipCloud}>
                {OUTCOME_EXAMPLES.map((example) => (
                  <Pill
                    key={example}
                    onPress={() => {
                      setOutcome(example);
                      setOutcomeError(null);
                    }}>
                    {example}
                  </Pill>
                ))}
              </View>
            </View>
            <Button variant="hero" fullWidth onPress={goFromOutcome}>
              Next
            </Button>
          </View>
        ) : null}

        {step === 'activities' ? (
          <View style={styles.stepContent}>
            <View style={styles.pageHeading}>
              <Text variant="h1">What might influence it?</Text>
              <Text variant="body" tone="soft">
                Add habits or choices you can mark complete each day.
              </Text>
            </View>
            <Field
              label="Activities to test"
              value={newActivity}
              onChangeText={(value) => {
                setNewActivity(value);
                if (value.trim()) setActivityFeedback(null);
              }}
              placeholder="e.g. morning walk, no caffeine after 2pm"
              hint={
                activityFeedback ??
                'Separate activities with commas to add multiple chips at once.'
              }
              error={activityFeedback}
              returnKeyType="done"
              onSubmitEditing={handleAddActivity}
              trailing={
                <Pressable
                  onPress={handleAddActivity}
                  accessibilityRole="button"
                  accessibilityLabel="Add activities"
                  style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                  <Text variant="h2" tone="inverse" weight="bold">
                    +
                  </Text>
                </Pressable>
              }
            />

            {activities.length > 0 ? (
              <ActivityCloud activities={activities} onRemove={removeActivity} />
            ) : null}

            <View style={styles.suggestions}>
              <Text variant="small" tone="soft">
                Starter ideas
              </Text>
              <View style={styles.chipCloud}>
                {ACTIVITY_STARTERS.map((starter) => (
                  <Pill key={starter} onPress={() => addActivities([starter])}>
                    {starter}
                  </Pill>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              <Button variant="secondary" onPress={() => setStep('outcome')}>
                Back
              </Button>
              <Button variant="hero" onPress={goFromActivities}>
                Review
              </Button>
            </View>
          </View>
        ) : null}

        {step === 'review' ? (
          <View style={styles.stepContent}>
            <View style={styles.pageHeading}>
              <Text variant="h1">Review your experiment</Text>
              <Text variant="body" tone="soft">
                Make sure this feels realistic enough to check in on every day.
              </Text>
            </View>

            <Card style={styles.reviewCard}>
              <View style={styles.summaryBlock}>
                <Text variant="caption" tone="soft" weight="bold">
                  OUTCOME
                </Text>
                <Text variant="h2">{outcome}</Text>
              </View>
              <View style={styles.summaryBlock}>
                <Text variant="caption" tone="soft" weight="bold">
                  ACTIVITIES
                </Text>
                <ActivityCloud activities={activities} />
              </View>
            </Card>

            <Card tone="info" busy={hypothesisLoading} style={styles.hypothesisCard}>
              <View style={styles.hypothesisHeader}>
                <Text variant="h2">Your hypothesis</Text>
                {!hypothesisLoading && hypothesis ? (
                  <Text variant="caption" tone={hypothesisFromAI ? 'primary' : 'soft'}>
                    {hypothesisFromAI ? 'AI generated' : 'Template'}
                  </Text>
                ) : null}
              </View>
              <Text variant="body" weight="medium">
                {hypothesis || 'Drafting a testable hypothesis from your setup…'}
              </Text>
            </Card>

            {hypothesisError ? <Callout tone="danger">{hypothesisError}</Callout> : null}
            {saveError ? <Callout tone="danger">{saveError}</Callout> : null}

            {canSave ? (
              <View style={styles.actions}>
                <Button variant="quiet" onPress={handleCancelReview}>
                  Cancel
                </Button>
                <Button variant="hero" loading={saving} onPress={() => void handleSave()}>
                  Save & continue
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  })();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={layout.keyboardVerticalOffset}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {content}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: space.xxl,
    paddingBottom: space.xxl + layout.tabBarHeight,
    backgroundColor: color.background,
  },
  content: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    gap: layout.sectionGap,
  },
  pageHeading: {
    gap: space.xs,
  },
  stepContent: {
    width: '100%',
    gap: space.lg,
  },
  progress: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    gap: space.xs,
  },
  progressBars: {
    flexDirection: 'row',
    gap: space.xs,
  },
  progressTarget: {
    flex: 1,
    minHeight: layout.minTouch,
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.border,
  },
  progressBarActive: {
    backgroundColor: color.primaryStrong,
  },
  chipCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  suggestions: {
    gap: space.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
  addButton: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.brand,
  },
  pressed: {
    opacity: 0.78,
  },
  reviewCard: {
    gap: space.lg,
  },
  summaryCard: {
    gap: space.lg,
  },
  summaryBlock: {
    gap: space.xs,
  },
  hypothesisCard: {
    gap: space.sm,
  },
  hypothesisHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  skeletonCard: {
    gap: space.md,
  },
  skeletonHeading: {
    alignSelf: 'center',
    width: '54%',
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: color.border,
  },
  skeletonLineWide: {
    width: '78%',
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: color.border,
  },
  skeletonLine: {
    width: '48%',
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: color.border,
  },
  skeletonField: {
    width: '100%',
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
});
