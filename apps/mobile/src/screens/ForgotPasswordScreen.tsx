import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, ApiError } from '../api/client';
import { colors } from '../theme/colors';

interface Props {
  onBackToLogin: () => void;
  onHaveResetCode: () => void;
}

export function ForgotPasswordScreen({ onBackToLogin, onHaveResetCode }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.requestPasswordReset({ email: email.trim() });
      // The API always responds the same way whether or not the email is
      // registered, so the UI can't (and shouldn't try to) distinguish the
      // two — that's what stops an attacker from using this form to check
      // which emails have accounts.
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          If an account exists for {email.trim()}, we&apos;ve sent instructions for resetting your
          password.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onHaveResetCode} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>I have a reset code</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBackToLogin}>
          <Text style={styles.linkText}>Back to log in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.subtitle}>
        Enter the email address on your account and we&apos;ll send you instructions to reset your
        password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email address"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={submit}
        disabled={submitting || !email.trim()}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.primaryButtonText}>Send reset instructions</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onHaveResetCode}>
        <Text style={styles.linkText}>I already have a reset code</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBackToLogin}>
        <Text style={styles.linkText}>Back to log in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 12 },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
  linkText: { color: colors.primary, textAlign: 'center', marginTop: 20, fontSize: 14 },
  error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
});
