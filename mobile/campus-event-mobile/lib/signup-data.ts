export type AccountType = 'student' | 'organization' | 'regular';

export const ACCOUNT_TYPES: Array<{
  id: AccountType;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: 'student',
    label: 'Student',
    title: 'Campus student',
    description: 'Use a .edu email, choose your school, and start in your campus community.',
  },
  {
    id: 'organization',
    label: 'Organization',
    title: 'Organization',
    description: 'For universities, clubs, teams, departments, brands, and official pages.',
  },
  {
    id: 'regular',
    label: 'Regular',
    title: 'Regular account',
    description: 'A standalone profile for discovering events and following communities.',
  },
];

export const GENDER_OPTIONS = ['Male', 'Female'] as const;

export const BIRTH_MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const ORGANIZATION_TYPES = [
  'University',
  'College',
  'Brand',
  'Business',
  'Club',
  'Student Organization',
  'Department',
  'Sports Team',
  'Other',
];

export const INTEREST_OPTIONS = [
  'Sports',
  'Movies',
  'Music',
  'Parties',
  'Campus Life',
  'Tech',
  'Gaming',
  'Fashion',
  'Business',
  'Fitness',
  'Food',
  'Nightlife',
  'Study Groups',
  'Career Events',
  'Greek Life',
  'Concerts',
];

export const US_SCHOOLS = [
  { id: 'umes', label: 'University of Maryland Eastern Shore', domains: ['umes.edu'] },
  { id: 'umd', label: 'University of Maryland, College Park', domains: ['umd.edu'] },
  { id: 'morgan-state', label: 'Morgan State University', domains: ['morgan.edu'] },
  { id: 'howard', label: 'Howard University', domains: ['howard.edu'] },
  { id: 'hampton', label: 'Hampton University', domains: ['hamptonu.edu'] },
  { id: 'norfolk-state', label: 'Norfolk State University', domains: ['nsu.edu'] },
  { id: 'delaware-state', label: 'Delaware State University', domains: ['desu.edu'] },
  { id: 'bowie-state', label: 'Bowie State University', domains: ['bowiestate.edu'] },
  { id: 'johns-hopkins', label: 'Johns Hopkins University', domains: ['jhu.edu'] },
  { id: 'georgetown', label: 'Georgetown University', domains: ['georgetown.edu'] },
  { id: 'american', label: 'American University', domains: ['american.edu'] },
  { id: 'gwu', label: 'George Washington University', domains: ['gwu.edu'] },
  { id: 'harvard', label: 'Harvard University', domains: ['harvard.edu'] },
  { id: 'mit', label: 'Massachusetts Institute of Technology', domains: ['mit.edu'] },
  { id: 'stanford', label: 'Stanford University', domains: ['stanford.edu'] },
  { id: 'uc-berkeley', label: 'University of California, Berkeley', domains: ['berkeley.edu'] },
  { id: 'ucla', label: 'University of California, Los Angeles', domains: ['ucla.edu'] },
  { id: 'usc', label: 'University of Southern California', domains: ['usc.edu'] },
  { id: 'nyu', label: 'New York University', domains: ['nyu.edu'] },
  { id: 'columbia', label: 'Columbia University', domains: ['columbia.edu'] },
  { id: 'cornell', label: 'Cornell University', domains: ['cornell.edu'] },
  { id: 'upenn', label: 'University of Pennsylvania', domains: ['upenn.edu'] },
  { id: 'princeton', label: 'Princeton University', domains: ['princeton.edu'] },
  { id: 'yale', label: 'Yale University', domains: ['yale.edu'] },
  { id: 'duke', label: 'Duke University', domains: ['duke.edu'] },
  { id: 'unc', label: 'University of North Carolina at Chapel Hill', domains: ['unc.edu'] },
  { id: 'uva', label: 'University of Virginia', domains: ['virginia.edu'] },
  { id: 'virginia-tech', label: 'Virginia Tech', domains: ['vt.edu'] },
  { id: 'penn-state', label: 'Penn State University', domains: ['psu.edu'] },
  { id: 'ohio-state', label: 'The Ohio State University', domains: ['osu.edu'] },
  { id: 'umich', label: 'University of Michigan', domains: ['umich.edu'] },
  { id: 'msu', label: 'Michigan State University', domains: ['msu.edu'] },
  { id: 'illinois', label: 'University of Illinois Urbana-Champaign', domains: ['illinois.edu'] },
  { id: 'northwestern', label: 'Northwestern University', domains: ['northwestern.edu'] },
  { id: 'uchicago', label: 'University of Chicago', domains: ['uchicago.edu'] },
  { id: 'notre-dame', label: 'University of Notre Dame', domains: ['nd.edu'] },
  { id: 'texas', label: 'The University of Texas at Austin', domains: ['utexas.edu'] },
  { id: 'texas-am', label: 'Texas A&M University', domains: ['tamu.edu'] },
  { id: 'rice', label: 'Rice University', domains: ['rice.edu'] },
  { id: 'florida', label: 'University of Florida', domains: ['ufl.edu'] },
  { id: 'fsu', label: 'Florida State University', domains: ['fsu.edu'] },
  { id: 'miami', label: 'University of Miami', domains: ['miami.edu'] },
  { id: 'georgia-tech', label: 'Georgia Institute of Technology', domains: ['gatech.edu'] },
  { id: 'emory', label: 'Emory University', domains: ['emory.edu'] },
  { id: 'asu', label: 'Arizona State University', domains: ['asu.edu'] },
  { id: 'washington', label: 'University of Washington', domains: ['washington.edu'] },
  { id: 'oregon', label: 'University of Oregon', domains: ['uoregon.edu'] },
  { id: 'colorado-boulder', label: 'University of Colorado Boulder', domains: ['colorado.edu'] },
];

export const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .replace(/^[._]+|[._]+$/g, '');

export const isValidUsername = (value: string) =>
  /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/.test(value);

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isEduEmail = (value: string) =>
  isValidEmail(value) && value.trim().toLowerCase().endsWith('.edu');

export const getPasswordChecks = (password: string) => ({
  length: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
});

export const isStrongPassword = (password: string) =>
  Object.values(getPasswordChecks(password)).every(Boolean);

export const sanitizePhoneNumber = (value: string) => value.replace(/[^\d+]/g, '');

export const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const buildLegacyBirthday = (birthMonth?: string, birthYear?: string) => {
  if (!birthMonth || !birthYear) return null;
  return `${birthYear}-${String(birthMonth).padStart(2, '0')}-01`;
};

export const buildProfileSummary = ({
  accountType,
  firstName,
  organizationName,
  interests,
}: {
  accountType: AccountType;
  firstName?: string;
  organizationName?: string;
  interests: string[];
}) => {
  if (accountType === 'organization') {
    return organizationName
      ? `Official updates and events from ${organizationName}.`
      : 'Sharing events, updates, and community moments.';
  }

  if (interests.length > 0) {
    return `Into ${interests.slice(0, 3).join(', ')}`;
  }

  return firstName
    ? `${firstName} is exploring campus events.`
    : 'Exploring campus events and new people.';
};
