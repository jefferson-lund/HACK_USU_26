import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { getSetup, initDatabase, saveSetup } from '@/lib/database';

export default function TodaySetupScreen() {
  const [outcome, setOutcome] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  useEffect(() => {
    const loadSetup = async () => {
      await initDatabase();
      const setup = await getSetup();
      if (setup) {
        setOutcome(setup.outcome);
        setActivities(setup.activities);
        setIsSetupComplete(true);
      }
    };
    loadSetup();
  }, []);

  const handleAddActivity = () => {
    const trimmed = newActivity.trim();
    if (!trimmed) return;
    if (activities.includes(trimmed)) {
      setNewActivity('');
      return;
    }
    setActivities((prev) => [...prev, trimmed]);
    setNewActivity('');
  };

  const generateBasicHypothesis = () => {
    if (!outcome.trim() || activities.length === 0) return '';
    
    const activitiesList = activities.join(', ');
    return `If I do these things: ${activitiesList}, then I will ${outcome.trim()}.`;
  };

  const hypothesis = generateBasicHypothesis();

  const handleSaveSetup = async () => {
    if (!outcome.trim() || activities.length === 0) return;
    console.log('Saving setup:', { outcome, activities });
    await saveSetup(outcome, activities);
    console.log('Setup saved successfully');
    setIsSetupComplete(true);
  };

  if (isSetupComplete) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Setup Complete!</Text>
        <Text style={styles.subtitle}>Go to the Track tab to log your daily activities.</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Your hypothesis</Text>
          <View style={styles.hypothesisBox}>
            <Text style={styles.hypothesisText}>{hypothesis}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Your activities</Text>
          <View style={styles.chipContainer}>
            {activities.map((activity) => (
              <View key={activity} style={styles.chip}>
                <Text style={styles.chipText}>{activity}</Text>
              </View>
            ))}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setIsSetupComplete(false)}
        >
          <Text style={styles.addButtonText}>Edit Setup</Text>
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
        <Text style={styles.title}>Set up your goal</Text>
        <Text style={styles.subtitle}>
          Start by telling us what you want to improve and which activities you believe influence
          that outcome.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Outcome</Text>
          <Text style={styles.helper}>
            Example: "have more energy", "lose weight", "feel less anxious".
          </Text>
          <TextInput
            value={outcome}
            onChangeText={setOutcome}
            placeholder="I want to…"
            placeholderTextColor="#999"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Activities you think matter</Text>
          <Text style={styles.helper}>
            Add daily activities you believe affect your outcome. We'll track them neutrally—no
            praise or guilt.
          </Text>

          <View style={styles.row}>
            <TextInput
              value={newActivity}
              onChangeText={setNewActivity}
              placeholder="e.g. morning walk, no caffeine after 2pm"
              placeholderTextColor="#999"
              style={[styles.input, styles.inputFlex]}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddActivity}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {activities.length > 0 && (
            <View style={styles.chipContainer}>
              {activities.map((activity) => (
                <View key={activity} style={styles.chip}>
                  <Text style={styles.chipText}>{activity}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {hypothesis && (
          <View style={styles.section}>
            <Text style={styles.label}>Your working hypothesis</Text>
            <View style={styles.hypothesisBox}>
              <Text style={styles.hypothesisText}>{hypothesis}</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={handleSaveSetup}>
              <Text style={styles.addButtonText}>Save Setup</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  helper: {
    fontSize: 12,
    opacity: 0.8,
  },
  input: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputFlex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563eb',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.5)',
  },
  chipText: {
    fontSize: 13,
  },
  hypothesisBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.5)',
  },
  hypothesisText: {
    fontSize: 14,
  },
});
