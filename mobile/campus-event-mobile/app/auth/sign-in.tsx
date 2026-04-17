import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';

export default function SignInScreen() {
  const router = useRouter();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { authError, signIn } = useMobileApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage('');
    setIsSubmitting(true);

    const result = await signIn({ email, password });

    if (!result.ok) {
      setErrorMessage(result.error || 'Unable to sign in right now.');
      setIsSubmitting(false);
      return;
    }

    router.replace('/(tabs)/home');
  };

  return (
    <AppScreen style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in with the same account and shared Supabase data the website already uses.
        </Text>

        {notice ? <Text style={styles.notice}>{String(notice)}</Text> : null}
        {authError ? <Text style={styles.error}>{authError}</Text> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          style={styles.input}
        />

        <Pressable style={styles.button} onPress={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>

        <Link href="/auth/sign-up" style={styles.link}>
          Need an account? Sign up
        </Link>
      </View>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      padding: 22,
      borderRadius: 28,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 4,
    },
    notice: {
      color: theme.success,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    error: {
      color: theme.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: theme.text,
      fontSize: 15,
    },
    button: {
      marginTop: 4,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.accent,
    },
    buttonText: {
      color: theme.background,
      fontSize: 15,
      fontWeight: '800',
    },
    link: {
      color: theme.text,
      textAlign: 'center',
      fontWeight: '700',
      marginTop: 8,
    },
  });
