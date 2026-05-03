import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  OnbBanner,
  OnbGhostButton,
  OnbInput,
  OnbPrimaryButton,
  OnbSubtitle,
  OnbTitle,
  onbColors,
  onbLayout,
} from '@/components/onboarding/onboarding-primitives';
import { useMobileApp } from '@/providers/mobile-app-provider';

export default function SignInScreen() {
  const router = useRouter();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const { authError, signIn } = useMobileApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    setErrorMessage('');
    setIsSubmitting(true);
    const result = await signIn({ email: email.trim().toLowerCase(), password });
    if (!result.ok) {
      setErrorMessage(result.error || 'Unable to sign in right now.');
      setIsSubmitting(false);
      return;
    }
    router.replace('/(tabs)/home');
  };

  const ready = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[onbLayout.body, { flexGrow: 1, paddingTop: 80 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingTop: 24, paddingBottom: 16 }}>
            <OnbTitle>Welcome back</OnbTitle>
            <OnbSubtitle>Log in to discover and manage campus events.</OnbSubtitle>
          </View>

          <OnbBanner tone="success">{notice ? String(notice) : undefined}</OnbBanner>
          <OnbBanner tone="error">{errorMessage || authError || undefined}</OnbBanner>

          <OnbInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <OnbInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            rightSlot={
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />

          <Pressable
            onPress={() => router.push('/auth/forgot-password')}
            hitSlop={6}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>

          <View style={onbLayout.spacer} />

          <View style={onbLayout.actions}>
            <OnbPrimaryButton onPress={() => void handleSubmit()} disabled={!ready}>
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </OnbPrimaryButton>
            <OnbGhostButton onPress={() => router.replace('/auth/sign-up')}>
              Create account
            </OnbGhostButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onbColors.bg },
  toggle: { color: onbColors.textSecondary, fontSize: 13, fontWeight: '500' },
  forgotRow: { alignItems: 'flex-end', marginTop: -4 },
  forgotLink: { color: onbColors.link, fontSize: 13, fontWeight: '500' },
});
