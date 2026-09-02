import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, ApiError } from '../api/client';
import { type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  onResetComplete: () => void;
  onBackToLogin: () => void;
}

export function ResetPasswordScreen({ onResetComplete, onBackToLogin }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.confirmPasswordReset({ token: token.trim(), newPassword });
      onResetComplete();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? 'That reset code is invalid or has expired. Request a new one and try again.'
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your reset code</Text>
      <Text style={styles.subtitle}>
        Paste the reset code from your email, then choose a new password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Reset code"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={setToken}
        accessibilityLabel="Reset code"
      />
      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        accessibilityLabel="New password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={submit}
        disabled={submitting || !token.trim() || newPassword.length < 8}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.primaryButtonText}>Set new password</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBackToLogin}>
        <Text style={styles.linkText}>Back to log in</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 12 },
  subtitle: {
    fontSize: 15,
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: c.text,
  },
  primaryButton: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: c.primaryText, fontSize: 17, fontWeight: '600' },
  linkText: { color: c.primary, textAlign: 'center', marginTop: 20, fontSize: 14 },
  error: { color: c.danger, marginBottom: 12, fontSize: 14 },
  });
}
