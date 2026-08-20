import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { getSetup, initDatabase, saveSetup } from '@/lib/database';
import { generateHypothesis } from '@/lib/llm';
import LaserDinosaur from '@/components/LaserDinosaur';
import { Brand } from '@/constants/Colors';

const HYPOTHESIS_DEBOUNCE_MS = 600;

export default function TodaySetupScreen() {
  const [outcome, setOutcome] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [hypothesis, setHypothesis] = useState('');
  const [hypothesisFromAI, setHypothesisFromAI] = useState(false);
  const [hypothesisLoading, setHypothesisLoading] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [showDinos, setShowDinos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hypothesisError, setHypothesisError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow earlier request resolving after a newer one and
  // overwriting the fresher hypothesis.
  const hypothesisGenRef = useRef(0);
  const dinoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadSetup = async () => {
      try {
        await initDatabase();
        const setup = await getSetup();
        if (setup) {
          setOutcome(setup.outcome);
          setActivities(setup.activities);
          setIsSetupComplete(true);
        }
      } catch (error) {
        console.error('Failed to load setup:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSetup();
  }, []);

  // The easter-egg timer outlived the component before this.
  useEffect(
    () => () => {
      if (dinoTimerRef.current) clearTimeout(dinoTimerRef.current);
    },
    []
  );

  const fetchHypothesis = useCallback(async (outcomeText: string, activityList: string[]) => {
    if (!outcomeText.trim() || activityList.length === 0) {
      // Bump the generation so any in-flight response is discarded rather
      // than landing after the field was cleared.
      hypothesisGenRef.current += 1;
      setHypothesis('');
      setHypothesisFromAI(false);
      setHypothesisError(null);
      return;
    }

    const generation = ++hypothesisGenRef.current;
    setHypothesisLoading(true);
    setHypothesisError(null);
    try {
      const { hypothesis: text, usedFallback } = await generateHypothesis(
        outcomeText.trim(),
        activityList,
      );
      if (generation !== hypothesisGenRef.current) return;
      setHypothesis(text);
      setHypothesisFromAI(!usedFallback);
    } catch (error) {
      if (generation !== hypothesisGenRef.current) return;
      // This used to be a bare `catch {}` that silently blanked the box, so a
      // failure was indistinguishable from having typed nothing.
      console.error('Failed to generate hypothesis:', error);
      setHypothesis('');
      setHypothesisFromAI(false);
      setHypothesisError('Could not draft a hypothesis right now. You can still save your setup.');
    } finally {
      if (generation === hypothesisGenRef.current) setHypothesisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!outcome.trim() || activities.length === 0) {
      // Bump the generation so a request already in flight is discarded.
      // Without this, clearing the outcome blanked the box and then the stale
      // response put the old hypothesis straight back -- and left
      // hypothesisLoading true, pinning the "Generating..." spinner.
      hypothesisGenRef.current += 1;
      setHypothesis('');
      setHypothesisFromAI(false);
      setHypothesisError(null);
      setHypothesisLoading(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchHypothesis(outcome, activities);
    }, HYPOTHESIS_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [outcome, activities, fetchHypothesis]);

  const handleAddActivity = () => {
    const raw = newActivity.trim();
    if (!raw) return;
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setActivities((prev) => {
      const next = [...prev];
      for (const part of parts) {
        if (part && !next.includes(part)) next.push(part);
      }
      return next;
    });
    setNewActivity('');
  };

  const handleRemoveActivity = (activity: string) => {
    setActivities((prev) => prev.filter((a) => a !== activity));
  };

  const canSave = outcome.trim().length > 0 && activities.length > 0;

  const handleSaveSetup = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Trimmed on save: the hypothesis already used the trimmed value, so an
      // untrimmed outcome was stored and displayed inconsistently.
      await saveSetup(outcome.trim(), activities);
      setIsSetupComplete(true);
    } catch (error) {
      console.error('Failed to save setup:', error);
      setSaveError('Could not save your setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBrandTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= 5) {
      setShowDinos(true);
      if (dinoTimerRef.current) clearTimeout(dinoTimerRef.current);
      dinoTimerRef.current = setTimeout(() => {
        dinoTimerRef.current = null;
        setShowDinos(false);
        setTapCount(0);
      }, 3500);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  if (isSetupComplete) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {showDinos && (
          <>
            <LaserDinosaur key="dino1" />
            <LaserDinosaur key="dino2" />
            <LaserDinosaur key="dino3" />
          </>
        )}
        <TouchableOpacity onPress={handleBrandTap} activeOpacity={0.8}>
          <Text style={styles.brandTitle}>wohl</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Hypothesis</Text>
        <View style={styles.section}>
          <View style={styles.hypothesisBox}>
            {hypothesisLoading ? (
              <View style={styles.hypothesisLoading}>
                <ActivityIndicator size="small" color={Brand.blue} />
                <Text style={styles.hypothesisLoadingText}>Generating…</Text>
              </View>
            ) : (
              <Text style={styles.hypothesisText}>{hypothesis}</Text>
            )}
          </View>
          {!hypothesisLoading && (
            <Text style={hypothesisFromAI ? styles.aiLabel : styles.fallbackLabel}>
              {hypothesisFromAI ? 'AI Generated' : 'Template'}
            </Text>
          )}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Activities</Text>
          <View style={styles.chipContainer}>
            {activities.map((activity) => (
              <View key={activity} style={styles.chip}>
                <Text style={styles.chipText}>{activity}</Text>
              </View>
            ))}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => setIsSetupComplete(false)}
        >
          <Text style={styles.editButtonText}>Edit Setup</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {showDinos && (
          <>
            <LaserDinosaur key="dino1" />
            <LaserDinosaur key="dino2" />
            <LaserDinosaur key="dino3" />
          </>
        )}
        <TouchableOpacity onPress={handleBrandTap} activeOpacity={0.8}>
          <Text style={styles.brandTitle}>wohl</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Define Your Goal</Text>
        <Text style={styles.subtitle}>
          What do you want to improve? Which activities might influence it?
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Outcome</Text>
          <TextInput
            value={outcome}
            onChangeText={setOutcome}
            placeholder="I want to…"
            placeholderTextColor={Brand.inkFaint}
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activities</Text>

          <View style={styles.row}>
            <TextInput
              value={newActivity}
              onChangeText={setNewActivity}
              placeholder="e.g. morning walk, no caffeine after 2pm"
              placeholderTextColor={Brand.inkFaint}
              style={[styles.input, styles.inputFlex]}
              onSubmitEditing={handleAddActivity}
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Enter') handleAddActivity();
              }}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddActivity}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {activities.length > 0 && (
            <View style={styles.chipContainer}>
              {activities.map((activity) => (
                <View key={activity} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {activity}
                  </Text>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleRemoveActivity(activity)}
                    style={styles.chipRemove}
                  >
                    <Text style={styles.chipRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {(hypothesis || hypothesisLoading) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Hypothesis</Text>
            <View style={styles.hypothesisBox}>
              {hypothesisLoading ? (
                <View style={styles.hypothesisLoading}>
                  <ActivityIndicator size="small" color={Brand.blue} />
                  <Text style={styles.hypothesisLoadingText}>Generating…</Text>
                </View>
              ) : (
                <Text style={styles.hypothesisText}>{hypothesis}</Text>
              )}
            </View>
            {!hypothesisLoading && (
              <Text style={hypothesisFromAI ? styles.aiLabel : styles.fallbackLabel}>
                {hypothesisFromAI ? 'AI Generated' : 'Template'}
              </Text>
            )}
          </View>
        )}

        {hypothesisError && <Text style={styles.errorText}>{hypothesisError}</Text>}

        {/*
          Save lives here, a sibling of the hypothesis section rather than a
          child of it. Nested inside, it only existed once a hypothesis had been
          produced -- so it appeared ~600ms after typing stopped, and if the
          draft failed the user could never save at all.
        */}
        {canSave && (
          <View style={styles.section}>
            {saveError && <Text style={styles.errorText}>{saveError}</Text>}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveSetup}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving…' : 'Save & Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 40,
    backgroundColor: Brand.white,
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: Brand.orange,
    letterSpacing: -1,
    marginBottom: -8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: Brand.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: Brand.inkSoft,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  section: {
    gap: 16,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Brand.ink,
    textAlign: 'center',
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
  inputFlex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 24,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Brand.chipBackground,
    borderWidth: 1,
    borderColor: Brand.chipBorder,
    gap: 6,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 14,
    flexShrink: 1,
    color: Brand.ink,
    fontWeight: '500',
  },
  chipRemove: {
    padding: 4,
    marginLeft: 2,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRemoveText: {
    fontSize: 18,
    lineHeight: 20,
    color: Brand.inkFaint,
    fontWeight: '400',
  },
  hypothesisBox: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: Brand.blueTint,
    borderWidth: 2,
    borderColor: Brand.blue,
    shadowColor: Brand.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  hypothesisText: {
    fontSize: 17,
    lineHeight: 26,
    color: Brand.ink,
    fontWeight: '500',
    textAlign: 'center',
  },
  hypothesisLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  hypothesisLoadingText: {
    fontSize: 16,
    color: Brand.inkSoft,
  },
  aiLabel: {
    fontSize: 12,
    textAlign: 'center',
    color: Brand.blue,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fallbackLabel: {
    fontSize: 12,
    textAlign: 'center',
    color: Brand.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  saveButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Brand.blue,
    alignSelf: 'center',
    shadowColor: Brand.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    color: Brand.danger,
  },
  saveButtonText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  editButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Brand.orange,
    alignSelf: 'center',
  },
  editButtonText: {
    color: Brand.orange,
    fontWeight: '600',
    fontSize: 16,
  },
});
