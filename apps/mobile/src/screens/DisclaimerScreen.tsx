import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DISCLAIMER_TEXT } from '@foodpadi/shared';
import { api } from '../api/client';
import { colors } from '../theme/colors';

export function DisclaimerScreen({ onAcknowledged }: { onAcknowledged: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  const acknowledge = async () => {
    setSubmitting(true);
    try {
      await api.acknowledgeDisclaimer();
      onAcknowledged();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Before you start</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.body}>{DISCLAIMER_TEXT}</Text>
      </ScrollView>
      <TouchableOpacity style={styles.button} onPress={acknowledge} disabled={submitting} accessibilityRole="button">
        <Text style={styles.buttonText}>I understand</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 64 },
  heading: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 16 },
  scroll: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  scrollContent: { padding: 16 },
  body: { fontSize: 14, lineHeight: 21, color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
});
