import { Link, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { useAppTheme } from '@/lib/app-theme';
import { supabase } from '@/lib/supabase';
import {
  ACCOUNT_TYPES,
  AccountType,
  BIRTH_MONTHS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  ORGANIZATION_TYPES,
  US_SCHOOLS,
  formatPhoneNumber,
  getPasswordChecks,
  isEduEmail,
  isStrongPassword,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  sanitizePhoneNumber,
} from '@/lib/signup-data';
import { useMobileApp } from '@/providers/mobile-app-provider';

type StepKey = 'account' | 'details' | 'interests';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

type SignUpForm = {
  firstName: string;
  lastName: string;
  organizationName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  birthMonth: string;
  birthYear: string;
  gender: '' | 'Male' | 'Female';
  schoolId: string;
  schoolSearch: string;
  organizationType: string;
  organizationDescription: string;
  organizationWebsite: string;
  parentOrganizationName: string;
};

const initialForm: SignUpForm = {
  firstName: '',
  lastName: '',
  organizationName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
  birthMonth: '',
  birthYear: '',
  gender: '',
  schoolId: '',
  schoolSearch: '',
  organizationType: '',
  organizationDescription: '',
  organizationWebsite: '',
  parentOrganizationName: '',
};

const getBirthYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const latestYear = currentYear - 13;
  const earliestYear = currentYear - 100;
  const years: string[] = [];

  for (let year = latestYear; year >= earliestYear; year -= 1) {
    years.push(String(year));
  }

  return years;
};

export default function SignUpScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { authError, signUp } = useMobileApp();
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [step, setStep] = useState<StepKey>('account');
  const [form, setForm] = useState<SignUpForm>(initialForm);
  const [selectedInterests, setSelectedInterests] = useState(['Sports', 'Campus Life']);
  const [interestQuery, setInterestQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  const isOrganization = accountType === 'organization';
  const isPersonalAccount = !isOrganization;
  const normalizedUsername = normalizeUsername(form.username);
  const selectedSchool = US_SCHOOLS.find((school) => school.id === form.schoolId);
  const birthYears = useMemo(() => getBirthYearOptions(), []);
  const steps = isPersonalAccount ? ['Account', 'Details', 'Interests'] : ['Account', 'Organization'];
  const activeStepIndex = step === 'account' ? 0 : step === 'details' ? 1 : 2;
  const passwordChecks = useMemo(() => getPasswordChecks(form.password), [form.password]);

  const filteredSchools = useMemo(() => {
    const query = form.schoolSearch.trim().toLowerCase();
    if (!query) return US_SCHOOLS.slice(0, 7);

    return US_SCHOOLS.filter((school) =>
      `${school.label} ${school.id} ${school.domains.join(' ')}`.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [form.schoolSearch]);

  const filteredInterests = useMemo(() => {
    const query = interestQuery.trim().toLowerCase();
    if (!query) return INTEREST_OPTIONS;
    return INTEREST_OPTIONS.filter((interest) => interest.toLowerCase().includes(query));
  }, [interestQuery]);

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    const cleanEmail = form.email.trim().toLowerCase();
    const cleanPhone = sanitizePhoneNumber(form.phoneNumber);

    if (!normalizedUsername) errors.username = 'Username is required.';
    else if (!isValidUsername(normalizedUsername)) {
      errors.username = 'Use 3-30 letters, numbers, dots, or underscores.';
    } else if (usernameStatus === 'taken') {
      errors.username = 'That username is already taken.';
    }

    if (!cleanEmail) errors.email = 'Email is required.';
    else if (!isValidEmail(cleanEmail)) errors.email = 'Enter a valid email address.';
    else if (accountType === 'student' && !isEduEmail(cleanEmail)) {
      errors.email = 'Student accounts require a .edu email.';
    }

    if (!isStrongPassword(form.password)) errors.password = 'Password does not meet every rule.';
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords must match.';
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      errors.phoneNumber = 'Phone number is required.';
    }

    if (isPersonalAccount) {
      if (!form.firstName.trim()) errors.firstName = 'First name is required.';
      if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
      if (!form.birthMonth) errors.birthMonth = 'Birth month is required.';
      if (!form.birthYear) errors.birthYear = 'Birth year is required.';
      if (!form.gender) errors.gender = 'Gender is required.';
      if (accountType === 'student' && !selectedSchool) errors.school = 'Choose your school.';
    } else {
      if (!form.organizationName.trim()) errors.organizationName = 'Organization name is required.';
      if (!form.organizationType) errors.organizationType = 'Organization type is required.';
      if (!form.organizationDescription.trim()) {
        errors.organizationDescription = 'Description is required.';
      }
      if (
        form.organizationWebsite.trim() &&
        !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(form.organizationWebsite.trim())
      ) {
        errors.organizationWebsite = 'Use a full URL starting with http:// or https://.';
      }
    }

    return {
      errors,
      detailsValid:
        Object.keys(errors).length === 0 &&
        usernameStatus !== 'checking' &&
        usernameStatus !== 'error',
      interestsValid: selectedInterests.length > 0,
    };
  }, [accountType, form, isPersonalAccount, normalizedUsername, selectedInterests.length, selectedSchool, usernameStatus]);

  useEffect(() => {
    if (!supabase || !normalizedUsername || !isValidUsername(normalizedUsername)) {
      setUsernameStatus('idle');
      return;
    }

    const client = supabase;
    let isActive = true;
    const timeoutId = setTimeout(async () => {
      setUsernameStatus('checking');

      const { data, error } = await client
        .from('profiles')
        .select('id')
        .eq('username', normalizedUsername)
        .maybeSingle();

      if (!isActive) return;
      if (error && error.code !== 'PGRST116') {
        setUsernameStatus('error');
        return;
      }

      setUsernameStatus(data ? 'taken' : 'available');
    }, 450);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [normalizedUsername]);

  const updateField = <K extends keyof SignUpForm>(field: K, value: SignUpForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((currentInterests) =>
      currentInterests.includes(interest)
        ? currentInterests.filter((item) => item !== interest)
        : [...currentInterests, interest]
    );
  };

  const checkUsernameAvailability = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error('We could not validate that username. Please try again.');
    }

    if (data) {
      throw new Error('That username is already taken.');
    }
  };

  const createAccount = async () => {
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await checkUsernameAvailability();

      const result = await signUp({
        accountType,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fullName: isOrganization
          ? form.organizationName.trim()
          : [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' '),
        username: normalizedUsername,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phoneNumber: sanitizePhoneNumber(form.phoneNumber),
        birthMonth: isOrganization ? undefined : form.birthMonth,
        birthYear: isOrganization ? undefined : form.birthYear,
        gender: isOrganization ? '' : form.gender,
        school: accountType === 'student' ? selectedSchool?.label || '' : undefined,
        schoolId: accountType === 'student' ? selectedSchool?.id || '' : undefined,
        organizationName: isOrganization ? form.organizationName.trim() : undefined,
        organizationType: isOrganization ? form.organizationType : undefined,
        organizationDescription: isOrganization
          ? form.organizationDescription.trim()
          : undefined,
        organizationWebsite: isOrganization
          ? form.organizationWebsite.trim() || undefined
          : undefined,
        parentOrganizationName: isOrganization
          ? form.parentOrganizationName.trim() || undefined
          : undefined,
        interests: isPersonalAccount ? selectedInterests : [],
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

      router.replace('/(tabs)/home');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create your account right now.');
      setIsSubmitting(false);
    }
  };

  const handleContinue = async () => {
    setErrorMessage('');

    if (step === 'account') {
      setStep('details');
      return;
    }

    if (step === 'details') {
      if (!validation.detailsValid) {
        setErrorMessage('Finish the required fields before continuing.');
        return;
      }

      if (isPersonalAccount) {
        setStep('interests');
        return;
      }

      await createAccount();
      return;
    }

    if (!validation.interestsValid) {
      setErrorMessage('Choose at least one interest to personalize your feed.');
      return;
    }

    await createAccount();
  };

  const renderError = (field: string) =>
    validation.errors[field] ? <Text style={styles.fieldError}>{validation.errors[field]}</Text> : null;

  const renderPasswordRules = () => (
    <View style={styles.passwordRules}>
      {[
        ['8+ characters', passwordChecks.length],
        ['uppercase', passwordChecks.uppercase],
        ['lowercase', passwordChecks.lowercase],
        ['number', passwordChecks.number],
      ].map(([label, met]) => (
        <Text key={String(label)} style={[styles.passwordRule, met ? styles.passwordRuleMet : null]}>
          {String(label)}
        </Text>
      ))}
    </View>
  );

  return (
    <AppScreen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.kicker}>Campus Event Navigation</Text>
            <Text style={styles.title}>
              {step === 'account'
                ? 'Create account'
                : step === 'interests'
                  ? 'Choose interests'
                  : isOrganization
                    ? 'Organization details'
                    : 'Your details'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'account'
                ? 'Pick the identity that matches how you will use the platform.'
                : step === 'interests'
                  ? 'Select a few signals so Discover has a smart starting point.'
                  : isOrganization
                    ? 'Set up an organization profile ready for verification and hierarchy later.'
                    : accountType === 'student'
                      ? 'Use your .edu email and campus to start in the right community.'
                      : 'Create a standalone profile for events, follows, and discovery.'}
            </Text>

            <View style={styles.progressRow}>
              {steps.map((label, index) => (
                <View
                  key={label}
                  style={[styles.progressStep, index <= activeStepIndex ? styles.progressStepActive : null]}>
                  <Text
                    style={[
                      styles.progressNumber,
                      index <= activeStepIndex ? styles.progressNumberActive : null,
                    ]}>
                    {index + 1}
                  </Text>
                  <Text
                    style={[
                      styles.progressLabel,
                      index <= activeStepIndex ? styles.progressLabelActive : null,
                    ]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            {authError ? <Text style={styles.error}>{authError}</Text> : null}
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            {step === 'account' ? (
              <View style={styles.accountGrid}>
                {ACCOUNT_TYPES.map((type) => (
                  <Pressable
                    key={type.id}
                    style={[
                      styles.accountCard,
                      accountType === type.id ? styles.accountCardActive : null,
                    ]}
                    onPress={() => setAccountType(type.id)}>
                    <Text style={styles.accountLabel}>{type.label}</Text>
                    <Text style={styles.accountTitle}>{type.title}</Text>
                    <Text style={styles.accountCopy}>{type.description}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {step === 'details' ? (
              <View style={styles.formGroup}>
                {isOrganization ? (
                  <>
                    <FieldLabel label="Organization name" styles={styles} />
                    <TextInput
                      value={form.organizationName}
                      onChangeText={(text) => updateField('organizationName', text)}
                      placeholder="UMES Basketball"
                      placeholderTextColor={theme.textMuted}
                      style={styles.input}
                    />
                    {renderError('organizationName')}

                    <FieldLabel label="Organization type" styles={styles} />
                    <ChipRow
                      options={ORGANIZATION_TYPES}
                      value={form.organizationType}
                      onSelect={(value) => updateField('organizationType', value)}
                      styles={styles}
                    />
                    {renderError('organizationType')}
                  </>
                ) : (
                  <>
                    <FieldLabel label="First name" styles={styles} />
                    <TextInput
                      value={form.firstName}
                      onChangeText={(text) => updateField('firstName', text)}
                      placeholder="Avery"
                      placeholderTextColor={theme.textMuted}
                      style={styles.input}
                      textContentType="givenName"
                    />
                    {renderError('firstName')}

                    <FieldLabel label="Last name" styles={styles} />
                    <TextInput
                      value={form.lastName}
                      onChangeText={(text) => updateField('lastName', text)}
                      placeholder="Jordan"
                      placeholderTextColor={theme.textMuted}
                      style={styles.input}
                      textContentType="familyName"
                    />
                    {renderError('lastName')}
                  </>
                )}

                <FieldLabel label="Username" styles={styles} />
                <TextInput
                  value={form.username}
                  onChangeText={(text) => updateField('username', normalizeUsername(text))}
                  placeholder={isOrganization ? 'umesbasketball' : 'averyafterdark'}
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Text
                  style={[
                    styles.helper,
                    usernameStatus === 'available' ? styles.helperSuccess : null,
                    usernameStatus === 'taken' || usernameStatus === 'error' ? styles.helperDanger : null,
                  ]}>
                  {usernameStatus === 'checking'
                    ? 'Checking username...'
                    : usernameStatus === 'available'
                      ? 'Username is available.'
                      : usernameStatus === 'taken'
                        ? 'That username is already taken.'
                        : 'Letters, numbers, dots, and underscores.'}
                </Text>
                {renderError('username')}

                <FieldLabel
                  label={isOrganization ? 'Organization email' : accountType === 'student' ? '.edu email' : 'Email'}
                  styles={styles}
                />
                <TextInput
                  value={form.email}
                  onChangeText={(text) => updateField('email', text)}
                  placeholder={accountType === 'student' ? 'name@school.edu' : 'name@example.com'}
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                {accountType === 'student' ? (
                  <Text style={styles.helper}>A .edu email is required for student accounts.</Text>
                ) : null}
                {renderError('email')}

                <FieldLabel label="Password" styles={styles} />
                <TextInput
                  value={form.password}
                  onChangeText={(text) => updateField('password', text)}
                  placeholder="Password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  style={styles.input}
                />
                {renderPasswordRules()}
                {renderError('password')}

                <FieldLabel label="Confirm password" styles={styles} />
                <TextInput
                  value={form.confirmPassword}
                  onChangeText={(text) => updateField('confirmPassword', text)}
                  placeholder="Confirm password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  style={styles.input}
                />
                {renderError('confirmPassword')}

                <FieldLabel label="Phone number" styles={styles} />
                <TextInput
                  value={form.phoneNumber}
                  onChangeText={(text) => updateField('phoneNumber', formatPhoneNumber(text))}
                  placeholder="(410) 555-0123"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                {renderError('phoneNumber')}

                {isPersonalAccount ? (
                  <>
                    <FieldLabel label="Birth month" styles={styles} />
                    <ChipRow
                      options={BIRTH_MONTHS.map((month) => month.label)}
                      value={BIRTH_MONTHS.find((month) => month.value === form.birthMonth)?.label || ''}
                      onSelect={(label) => {
                        const month = BIRTH_MONTHS.find((item) => item.label === label);
                        updateField('birthMonth', month?.value || '');
                      }}
                      styles={styles}
                    />
                    {renderError('birthMonth')}

                    <FieldLabel label="Birth year" styles={styles} />
                    <TextInput
                      value={form.birthYear}
                      onChangeText={(text) => updateField('birthYear', text.replace(/\D/g, '').slice(0, 4))}
                      placeholder={birthYears[0]}
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                    {renderError('birthYear')}

                    <FieldLabel label="Gender" styles={styles} />
                    <ChipRow
                      options={[...GENDER_OPTIONS]}
                      value={form.gender}
                      onSelect={(value) => updateField('gender', value as SignUpForm['gender'])}
                      styles={styles}
                    />
                    {renderError('gender')}
                  </>
                ) : (
                  <>
                    <FieldLabel label="Description" styles={styles} />
                    <TextInput
                      value={form.organizationDescription}
                      onChangeText={(text) => updateField('organizationDescription', text)}
                      placeholder="Official page for events, updates, and community moments."
                      placeholderTextColor={theme.textMuted}
                      multiline
                      style={[styles.input, styles.textArea]}
                    />
                    {renderError('organizationDescription')}

                    <FieldLabel label="Website" styles={styles} />
                    <TextInput
                      value={form.organizationWebsite}
                      onChangeText={(text) => updateField('organizationWebsite', text)}
                      placeholder="https://example.edu"
                      placeholderTextColor={theme.textMuted}
                      autoCapitalize="none"
                      keyboardType="url"
                      style={styles.input}
                    />
                    {renderError('organizationWebsite')}

                    <FieldLabel label="Parent organization" styles={styles} />
                    <TextInput
                      value={form.parentOrganizationName}
                      onChangeText={(text) => updateField('parentOrganizationName', text)}
                      placeholder="UMES"
                      placeholderTextColor={theme.textMuted}
                      style={styles.input}
                    />
                    <Text style={styles.helper}>Optional. Useful for future branch or team hierarchy.</Text>
                  </>
                )}

                {accountType === 'student' ? (
                  <>
                    <FieldLabel label="School" styles={styles} />
                    <TextInput
                      value={selectedSchool ? selectedSchool.label : form.schoolSearch}
                      onChangeText={(text) => {
                        updateField('schoolId', '');
                        updateField('schoolSearch', text);
                      }}
                      placeholder="Search U.S. colleges"
                      placeholderTextColor={theme.textMuted}
                      style={styles.input}
                    />
                    <View style={styles.schoolList}>
                      {filteredSchools.map((school) => (
                        <Pressable
                          key={school.id}
                          style={[
                            styles.schoolCard,
                            form.schoolId === school.id ? styles.schoolCardActive : null,
                          ]}
                          onPress={() => {
                            updateField('schoolId', school.id);
                            updateField('schoolSearch', school.label);
                          }}>
                          <Text style={styles.schoolTitle}>{school.label}</Text>
                          <Text style={styles.helper}>{school.domains[0]}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {renderError('school')}
                  </>
                ) : null}
              </View>
            ) : null}

            {step === 'interests' ? (
              <View style={styles.formGroup}>
                <TextInput
                  value={interestQuery}
                  onChangeText={setInterestQuery}
                  placeholder="Search interests"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
                <View style={styles.chipWrap}>
                  {filteredInterests.map((interest) => (
                    <Pressable
                      key={interest}
                      style={[
                        styles.chip,
                        selectedInterests.includes(interest) ? styles.chipActive : null,
                      ]}
                      onPress={() => toggleInterest(interest)}>
                      <Text
                        style={[
                          styles.chipText,
                          selectedInterests.includes(interest) ? styles.chipTextActive : null,
                        ]}>
                        {interest}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.helper}>
                  Selected: {selectedInterests.length}. These are stored on your profile to warm up recommendations.
                </Text>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              {step !== 'account' ? (
                <Pressable
                  style={[styles.secondaryButton, isSubmitting ? styles.buttonDisabled : null]}
                  onPress={() => setStep(step === 'interests' ? 'details' : 'account')}
                  disabled={isSubmitting}>
                  <Text style={styles.secondaryButtonText}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[
                  styles.button,
                  (isSubmitting ||
                    (step === 'details' && !validation.detailsValid) ||
                    (step === 'interests' && !validation.interestsValid)) &&
                    styles.buttonDisabled,
                ]}
                onPress={() => void handleContinue()}
                disabled={
                  isSubmitting ||
                  (step === 'details' && !validation.detailsValid) ||
                  (step === 'interests' && !validation.interestsValid)
                }>
                {isSubmitting ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <Text style={styles.buttonText}>
                    {step === 'account'
                      ? 'Continue'
                      : step === 'details' && isPersonalAccount
                        ? 'Continue to interests'
                        : 'Create Account'}
                  </Text>
                )}
              </Pressable>
            </View>

            <Link href="/auth/sign-in" style={styles.link}>
              Already have an account? Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function FieldLabel({
  label,
  styles,
}: {
  label: string;
  styles: ReturnType<typeof buildStyles>;
}) {
  return <Text style={styles.label}>{label}</Text>;
}

function ChipRow({
  options,
  value,
  onSelect,
  styles,
}: {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const selected = value === option;

        return (
          <Pressable
            key={option}
            style={[styles.chip, selected ? styles.chipActive : null]}
            onPress={() => onSelect(option)}>
            <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    keyboard: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 32,
    },
    card: {
      padding: 22,
      borderRadius: 28,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    kicker: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 4,
    },
    progressRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 4,
    },
    progressStep: {
      flex: 1,
      gap: 6,
    },
    progressStepActive: {},
    progressNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      overflow: 'hidden',
      textAlign: 'center',
      lineHeight: 28,
      backgroundColor: theme.surfaceAlt,
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    progressNumberActive: {
      backgroundColor: theme.accent,
      color: theme.background,
    },
    progressLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    progressLabelActive: {
      color: theme.text,
    },
    error: {
      color: theme.danger,
      backgroundColor: theme.dangerSoft,
      borderColor: theme.danger,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      lineHeight: 18,
    },
    accountGrid: {
      gap: 10,
    },
    accountCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 22,
      padding: 16,
      gap: 8,
    },
    accountCardActive: {
      borderColor: theme.accent,
      backgroundColor: theme.surface,
    },
    accountLabel: {
      alignSelf: 'flex-start',
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: theme.accentSoft,
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    accountTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    accountCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    formGroup: {
      gap: 9,
    },
    label: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
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
    textArea: {
      minHeight: 104,
      textAlignVertical: 'top',
    },
    helper: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    helperSuccess: {
      color: theme.success,
      fontWeight: '700',
    },
    helperDanger: {
      color: theme.danger,
      fontWeight: '700',
    },
    fieldError: {
      color: theme.danger,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    passwordRules: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },
    passwordRule: {
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor: theme.surfaceAlt,
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    passwordRuleMet: {
      backgroundColor: theme.successSoft,
      color: theme.success,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    chipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    chipText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    chipTextActive: {
      color: theme.background,
    },
    schoolList: {
      gap: 8,
    },
    schoolCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 16,
      padding: 12,
      gap: 3,
    },
    schoolCardActive: {
      borderColor: theme.accent,
      backgroundColor: theme.surface,
    },
    schoolTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    secondaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    button: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 15,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: theme.accent,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    buttonText: {
      color: theme.background,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    link: {
      color: theme.text,
      textAlign: 'center',
      fontWeight: '700',
      marginTop: 8,
    },
  });
