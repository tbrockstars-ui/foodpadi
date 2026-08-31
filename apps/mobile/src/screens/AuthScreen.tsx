import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { colors } from '../theme/colors';

interface Props {
  onForgotPassword: () => void;
  onContinueAsGuest: () => Promise<void>;
  successMessage?: string;
}

export function AuthScreen({ onForgotPassword, onContinueAsGuest, successMessage }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const continueAsGuest = async () => {
    setGuestLoading(true);
    try {
      await onContinueAsGuest();
    } catch {
      setError('Could not start a guest session. Please try again.');
    } finally {
      setGuestLoading(false);
    }
  };

  const emailLooksValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordLongEnough = password.length >= 8;
  const passwordsMatch = mode === 'login' || (confirmPassword.length > 0 && confirmPassword === password);
  const canSubmit = emailLooksValid && passwordLongEnough && passwordsMatch;

  const submit = async () => {
    if (!emailLooksValid || !passwordLongEnough) return;
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
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
      <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
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
      {password.length > 0 && !passwordLongEnough ? (
        <Text style={styles.hint}>At least 8 characters</Text>
      ) : null}

      {mode === 'register' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            accessibilityLabel="Confirm password"
          />
          {confirmPassword.length > 0 && confirmPassword !== password ? (
            <Text style={styles.hint}>Passwords don&apos;t match</Text>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={mode === 'login' ? 'Log in' : 'Create account'}
        onPress={submit}
        disabled={!canSubmit}
        loading={submitting}
        style={styles.primaryButton}
      />

      {mode === 'login' ? (
        <TouchableOpacity onPress={onForgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setConfirmPassword('');
          setError(null);
        }}
      >
        <Text style={styles.switchModeText}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity onPress={continueAsGuest} disabled={guestLoading} accessibilityRole="button">
        {guestLoading ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <Text style={styles.guestText}>Just want a quick idea? Continue without an account</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
  logo: { width: 84, height: 84, alignSelf: 'center', marginBottom: 16 },
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
  primaryButton: { marginTop: 8 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: -6, marginBottom: 12 },
  forgotPasswordText: { color: colors.textMuted, textAlign: 'center', marginTop: 16, fontSize: 14 },
  switchModeText: { color: colors.primary, textAlign: 'center', marginTop: 20, fontSize: 14 },
  error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
  success: { color: colors.primary, marginBottom: 16, fontSize: 14, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 13 },
  guestText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, textDecorationLine: 'underline' },
});
