import * as ExpoLinking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
  OnbTopBar,
  onbColors,
  onbLayout,
} from '@/components/onboarding/onboarding-primitives';
import { SUPABASE_CONFIG_ERROR, supabase } from '@/lib/supabase';

const PASSWORD_RULES_MESSAGE =
  'Use 8+ characters with uppercase, lowercase, number, and symbol.';

function validatePassword(password: string) {
  if (password.length < 8) return PASSWORD_RULES_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_RULES_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_RULES_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_RULES_MESSAGE;
  if (!/[^A-Za-z0-9]/.test(password)) return PASSWORD_RULES_MESSAGE;
  return '';
}

function readAuthParams(url: string | null) {
  if (!url) {
    return { accessToken: null, refreshToken: null, code: null, type: null };
  }

  const params = new URLSearchParams();
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');

  if (queryStart >= 0) {
    const queryEnd = hashStart >= 0 ? hashStart : url.length;
    new URLSearchParams(url.slice(queryStart + 1, queryEnd)).forEach((value, key) => {
      params.set(key, value);
    });
  }

  if (hashStart >= 0) {
    new URLSearchParams(url.slice(hashStart + 1)).forEach((value, key) => {
      params.set(key, value);
    });
  }

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    code: params.get('code'),
    type: params.get('type'),
  };
}

function redactResetUrl(url: string | null) {
  if (!url) return url;

  const [beforeHash, hash = ''] = url.split('#');
  const [base, query = ''] = beforeHash.split('?');
  const redactParams = (value: string) => {
    const params = new URLSearchParams(value);
    ['access_token', 'refresh_token', 'code'].forEach((key) => {
      if (params.has(key)) params.set(key, '[redacted]');
    });
    return params.toString();
  };

  const nextQuery = query ? `?${redactParams(query)}` : '';
  const nextHash = hash ? `#${redactParams(hash)}` : '';
  return `${base}${nextQuery}${nextHash}`;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const initialUrl = ExpoLinking.useURL();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const establishRecoverySession = async () => {
      if (!supabase) {
        setErrorMessage(SUPABASE_CONFIG_ERROR || 'Supabase is not configured.');
        return;
      }

      const url = initialUrl || (await ExpoLinking.getInitialURL());
      const { accessToken, refreshToken, code, type } = readAuthParams(url);

      console.info('[password-reset] current reset URL', {
        url: redactResetUrl(url),
      });
      console.info('[password-reset] recovery params found', {
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        hasCode: Boolean(code),
        type,
      });

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        console.info('[password-reset] setSession result', {
          ok: !error,
          error: error?.message || null,
        });
        if (error) {
          setErrorMessage(error.message || 'The reset link could not be opened.');
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        console.info('[password-reset] exchangeCodeForSession result', {
          ok: !error,
          error: error?.message || null,
        });
        if (error) {
          setErrorMessage(error.message || 'The reset link could not be opened.');
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      console.info('[password-reset] recovery session ready', {
        hasSession: Boolean(data.session),
      });
      if (isMounted) setHasRecoverySession(Boolean(data.session));
    };

    void establishRecoverySession();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initialUrl]);

  const passwordError = useMemo(() => {
    if (!newPassword) return '';
    return validatePassword(newPassword);
  }, [newPassword]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return '';
    return newPassword === confirmPassword ? '' : 'Passwords must match.';
  }, [confirmPassword, newPassword]);

  const handleSubmit = async () => {
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords must match.');
      return;
    }
    if (!supabase) {
      setErrorMessage(SUPABASE_CONFIG_ERROR || 'Supabase is not configured.');
      return;
    }
    if (!hasRecoverySession) {
      setErrorMessage('Open the reset link from your email before setting a new password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsSubmitting(false);
    console.info('[password-reset] update password result', {
      ok: !error,
      error: error?.message || null,
    });

    if (error) {
      setErrorMessage(error.message || 'Unable to update password right now.');
      return;
    }

    await supabase.auth.signOut();
    setInfoMessage('Password updated. Redirecting to login...');
    setTimeout(() => {
      router.replace({
        pathname: '/auth/sign-in',
        params: { notice: 'Password updated. Log in with your new password.' },
      });
    }, 1200);
  };

  const ready =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    !passwordError &&
    !confirmError &&
    !isSubmitting;

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
            <OnbTitle>Create new password</OnbTitle>
            <OnbSubtitle>Choose a strong password for your account.</OnbSubtitle>
          </View>

          <OnbBanner tone="success">{infoMessage || undefined}</OnbBanner>
          <OnbBanner tone="error">{errorMessage || undefined}</OnbBanner>

          <OnbInput
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            state={passwordError ? 'error' : newPassword ? 'success' : null}
            helper={passwordError || PASSWORD_RULES_MESSAGE}
            helperState={passwordError ? 'error' : null}
            rightSlot={
              <Pressable onPress={() => setShowNewPassword((value) => !value)} hitSlop={8}>
                <Text style={styles.toggle}>{showNewPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />

          <OnbInput
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            state={confirmError ? 'error' : confirmPassword ? 'success' : null}
            helper={confirmError}
            helperState={confirmError ? 'error' : null}
            rightSlot={
              <Pressable onPress={() => setShowConfirmPassword((value) => !value)} hitSlop={8}>
                <Text style={styles.toggle}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />

          <View style={onbLayout.spacer} />

          <View style={onbLayout.actions}>
            <OnbPrimaryButton onPress={() => void handleSubmit()} disabled={!ready}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
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
  toggle: { color: onbColors.textSecondary, fontSize: 13, fontWeight: '500' },
});
