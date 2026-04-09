import { Link, useRouter } from 'expo-router';
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

export default function SignUpScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { authError, signUp } = useMobileApp();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!username.trim()) {
      setErrorMessage('Username is required.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Email is required.');
      return;
    }

    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    const result = await signUp({
      fullName,
      username,
      email,
      password,
    });

    if (!result.ok) {
      setErrorMessage(result.error || 'Unable to create your account right now.');
      setIsSubmitting(false);
      return;
    }

    if (result.requiresEmailConfirmation) {
      router.replace({
        pathname: '/auth/sign-in',
        params: {
          notice: result.message || 'Account created. Check your email and then sign in.',
        },
      });
      return;
    }

    router.replace('/(tabs)/Discover');
  };

  return (
    <AppScreen style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Mobile now signs up into the same shared backend as the website, so use a real username.
        </Text>

        {authError ? <Text style={styles.error}>{authError}</Text> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={theme.textMuted}
          style={styles.input}
        />
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
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
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          style={styles.input}
        />

        <Pressable style={styles.button} onPress={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </Pressable>

        <Link href="/auth/sign-in" style={styles.link}>
          Already have an account? Sign in
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
