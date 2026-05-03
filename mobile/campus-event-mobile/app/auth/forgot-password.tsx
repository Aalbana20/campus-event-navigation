import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

import {
  OnbBanner,
  OnbGhostButton,
  OnbInput,
  OnbPrimaryButton,
  OnbSubtitle,
  OnbTitle,
  OnbTopBar,
  onbColors,
  onbLayout,
} from '@/components/onboarding/onboarding-primitives';
import { SUPABASE_CONFIG_ERROR, supabase } from '@/lib/supabase';

const RESET_SENT_MESSAGE =
  'If an account exists for that email, we sent password reset instructions.';
const COOLDOWN_SECONDS = 60;
const RESET_PASSWORD_REDIRECT_URL = 'campuseventmobile://reset-password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || isSubmitting || cooldown > 0) return;

    if (!supabase) {
      setErrorMessage(SUPABASE_CONFIG_ERROR || 'Supabase is not configured.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: RESET_PASSWORD_REDIRECT_URL,
    });

    setIsSubmitting(false);
    setCooldown(COOLDOWN_SECONDS);

    if (error) {
      setErrorMessage(error.message || 'Unable to send reset instructions right now.');
      return;
    }

    setInfoMessage(RESET_SENT_MESSAGE);
  };

  const ready = email.trim().length > 0 && !isSubmitting && cooldown === 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[onbLayout.body, { flexGrow: 1, paddingTop: 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <OnbTopBar onBack={() => router.replace('/auth/sign-in')} />

          <View style={{ paddingTop: 8, paddingBottom: 16 }}>
            <OnbTitle>Reset password</OnbTitle>
            <OnbSubtitle>Enter your email and we will send reset instructions.</OnbSubtitle>
          </View>

          <OnbBanner tone="success">{infoMessage || undefined}</OnbBanner>
          <OnbBanner tone="error">{errorMessage || undefined}</OnbBanner>

          <OnbInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <View style={onbLayout.spacer} />

          <View style={onbLayout.actions}>
            <OnbPrimaryButton onPress={() => void handleSubmit()} disabled={!ready}>
              {isSubmitting
                ? 'Sending...'
                : cooldown > 0
                  ? `Try again in ${cooldown}s`
                  : 'Send Reset Link'}
            </OnbPrimaryButton>
            <OnbGhostButton onPress={() => router.replace('/auth/sign-in')}>
              Back to login
            </OnbGhostButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onbColors.bg },
});
