import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { colors } from '../theme/colors';

interface Props {
  onForgotPassword: () => void;
  successMessage?: string;
}

export function AuthScreen({ onForgotPassword, successMessage }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FoodPadi</Text>
      <Text style={styles.subtitle}>Your food companion that plans with you, not for you.</Text>

      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

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
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={submit}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>
        )}
      </TouchableOpacity>

      {mode === 'login' ? (
        <TouchableOpacity onPress={onForgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={styles.switchModeText}>
          {mode === 'login' ? "New here? Create an account" : 'Already have an account? Log in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 32 },
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
  forgotPasswordText: { color: colors.textMuted, textAlign: 'center', marginTop: 16, fontSize: 14 },
  switchModeText: { color: colors.primary, textAlign: 'center', marginTop: 20, fontSize: 14 },
  error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
  success: { color: colors.primary, marginBottom: 16, fontSize: 14, textAlign: 'center' },
});
