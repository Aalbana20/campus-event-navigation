import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((collection, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return collection;
      }

      const [key, ...valueParts] = trimmed.split('=');
      collection[key.trim()] = valueParts
        .join('=')
        .trim()
        .replace(/^['"]|['"]$/g, '');
      return collection;
    }, {});
};

const env = {
  ...parseEnvFile(path.join(repoRoot, '.env')),
  ...parseEnvFile(path.join(repoRoot, '.env.local')),
  ...process.env,
};

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing Supabase service-role credentials. Run with SUPABASE_SERVICE_ROLE_KEY set, for example:\n' +
      'SUPABASE_SERVICE_ROLE_KEY=your_key npm run seed:test-data'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_PASSWORD = env.MOBILE_TEST_USER_PASSWORD || 'CampusTest123!';
const TEST_PREFIX = 'testcampus_';
const REAL_PROFILE_HINTS = ['success', 'ali', 'cody'];

const AVATAR_URL = (seed) =>
  `https://api.dicebear.com/8.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;

const EVENT_IMAGES = {
  sports:
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  parties:
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
  movies:
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
  music:
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
  networking:
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
  community:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
  campus:
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
};

const TEST_USERS = [
  ['Mila Stone', `${TEST_PREFIX}mila`, ['music', 'parties', 'networking']],
  ['Omar Greene', `${TEST_PREFIX}omar`, ['sports', 'community', 'music']],
  ['Nia Brooks', `${TEST_PREFIX}nia`, ['movies', 'music', 'arts']],
  ['Darius Cole', `${TEST_PREFIX}darius`, ['sports', 'parties', 'wellness']],
  ['Talia Frost', `${TEST_PREFIX}talia`, ['networking', 'community', 'food']],
  ['Jordan Hale', `${TEST_PREFIX}jordan`, ['music', 'movies', 'parties']],
  ['Ari Bennett', `${TEST_PREFIX}ari`, ['arts', 'community', 'networking']],
  ['Zoe Mercer', `${TEST_PREFIX}zoe`, ['wellness', 'movies', 'music']],
  ['Kendrick Moss', `${TEST_PREFIX}kendrick`, ['sports', 'community', 'food']],
  ['Priya Shah', `${TEST_PREFIX}priya`, ['networking', 'music', 'arts']],
  ['Xavier Lane', `${TEST_PREFIX}xavier`, ['parties', 'music', 'sports']],
  ['Leah Kim', `${TEST_PREFIX}leah`, ['movies', 'community', 'wellness']],
  ['Mateo Cruz', `${TEST_PREFIX}mateo`, ['sports', 'music', 'networking']],
  ['Sydney Park', `${TEST_PREFIX}sydney`, ['arts', 'movies', 'community']],
  ['Cam Riley', `${TEST_PREFIX}cam`, ['campus', 'parties', 'music']],
].map(([name, username, interests], index) => ({
  name,
  username,
  email: `${username}@example.com`,
  bio: `Test user for mobile QA. Into ${interests.join(', ')} and always looking for the next campus plan.`,
  interests,
  avatar_url: AVATAR_URL(username),
  phone_number: `410-555-01${String(index).padStart(2, '0')}`,
}));

const formatIsoDate = (offsetDays) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const formatDateLabel = (dateValue) =>
  new Date(`${dateValue}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

const EVENT_SPECS = [
  {
    title: 'Intramural 3v3 Finals',
    category: 'sports',
    dateOffset: 1,
    start_time: '18:30',
    end_time: '20:30',
    location: 'Rec Center Courts',
    location_address: 'Rec Center Courts, Princess Anne, MD',
    organizer: 'Campus Rec League',
    dress_code: 'Athletic',
    tags: ['sports', 'basketball', 'campus'],
    description: 'The last intramural bracket of the semester with music, open seating, and a fast crowd.',
    creatorUsername: `${TEST_PREFIX}omar`,
  },
  {
    title: 'Rooftop Kickback at Sunset',
    category: 'parties',
    dateOffset: 2,
    start_time: '21:00',
    end_time: '23:45',
    location: 'Residence Hall Rooftop',
    location_address: 'North Hall Rooftop, Princess Anne, MD',
    organizer: 'After Hours Collective',
    dress_code: 'Casual',
    tags: ['party', 'nightlife', 'social'],
    description: 'A laid-back rooftop link-up with a DJ set, mocktails, and the kind of crowd that knows everybody.',
    creatorUsername: `${TEST_PREFIX}cam`,
  },
  {
    title: 'Late-Night Horror Screening',
    category: 'movies',
    dateOffset: 3,
    start_time: '20:00',
    end_time: '22:15',
    location: 'Student Center Theater',
    location_address: 'Student Center Theater, Princess Anne, MD',
    organizer: 'Film Club',
    dress_code: 'Cozy',
    tags: ['movies', 'film', 'screening'],
    description: 'Bring a blanket, grab popcorn, and settle in for a campus favorite horror pick.',
    creatorUsername: `${TEST_PREFIX}leah`,
  },
  {
    title: 'Producer Showcase and Open Mic',
    category: 'music',
    dateOffset: 4,
    start_time: '19:30',
    end_time: '22:00',
    location: 'Black Box Studio',
    location_address: 'Arts Building Studio, Princess Anne, MD',
    organizer: 'Creative Sound Lab',
    dress_code: 'Expressive',
    tags: ['music', 'concert', 'open-mic'],
    description: 'Student producers, singers, and poets are trading short sets in one tight room.',
    creatorUsername: `${TEST_PREFIX}mila`,
  },
  {
    title: 'Career Mixer: Product and Design',
    category: 'networking',
    dateOffset: 5,
    start_time: '17:30',
    end_time: '19:30',
    location: 'Innovation Lounge',
    location_address: 'Business Hall, Princess Anne, MD',
    organizer: 'Career Services',
    dress_code: 'Smart casual',
    tags: ['networking', 'career', 'community'],
    description: 'Students, alumni, and visiting teams mixing around internships, portfolios, and side projects.',
    creatorUsername: `${TEST_PREFIX}talia`,
  },
  {
    title: 'Saturday River Cleanup',
    category: 'community',
    dateOffset: 6,
    start_time: '09:00',
    end_time: '11:30',
    location: 'Manokin River Trail',
    location_address: 'Manokin River Trailhead, Princess Anne, MD',
    organizer: 'Community Impact Board',
    dress_code: 'Outdoor',
    tags: ['community', 'volunteer', 'campus'],
    description: 'A clean volunteer morning with coffee, gloves, and shuttles from campus.',
    creatorUsername: `${TEST_PREFIX}ari`,
  },
  {
    title: 'Outdoor Movie on the Quad',
    category: 'movies',
    dateOffset: 7,
    start_time: '20:15',
    end_time: '22:10',
    location: 'Main Quad',
    location_address: 'Main Quad, Princess Anne, MD',
    organizer: 'Residence Life',
    dress_code: 'Blankets welcome',
    tags: ['movies', 'campus', 'community'],
    description: 'An easy outdoor screening with beanbags, food trucks, and a packed lawn.',
    creatorUsername: `${TEST_PREFIX}zoe`,
  },
  {
    title: 'Friday DJ Set at Commons',
    category: 'music',
    dateOffset: 8,
    start_time: '22:00',
    end_time: '00:30',
    location: 'Campus Commons',
    location_address: 'Campus Commons Plaza, Princess Anne, MD',
    organizer: 'Night Shift Collective',
    dress_code: 'Night out',
    tags: ['music', 'party', 'dj'],
    description: 'A bigger Friday crowd, faster music, and a lot of people rolling in after the game.',
    creatorUsername: `${TEST_PREFIX}xavier`,
  },
  {
    title: 'Flag Football Tryout Night',
    category: 'sports',
    dateOffset: 10,
    start_time: '18:00',
    end_time: '20:00',
    location: 'South Practice Field',
    location_address: 'South Practice Field, Princess Anne, MD',
    organizer: 'Campus Rec League',
    dress_code: 'Athletic',
    tags: ['sports', 'football', 'wellness'],
    description: 'Open tryouts with captains watching, warmups built in, and a lot of new faces.',
    creatorUsername: `${TEST_PREFIX}mateo`,
  },
  {
    title: 'Women in Tech Breakfast',
    category: 'networking',
    dateOffset: 11,
    start_time: '08:30',
    end_time: '10:00',
    location: 'STEM Commons',
    location_address: 'STEM Commons, Princess Anne, MD',
    organizer: 'Women in Tech',
    dress_code: 'Casual professional',
    tags: ['networking', 'community', 'campus'],
    description: 'Breakfast, mentorship rounds, and easy intros for internships and research connections.',
    creatorUsername: `${TEST_PREFIX}priya`,
  },
  {
    title: 'Student Org Fair After Hours',
    category: 'campus',
    dateOffset: 12,
    start_time: '18:00',
    end_time: '20:30',
    location: 'Student Center Ballroom',
    location_address: 'Student Center Ballroom, Princess Anne, MD',
    organizer: 'Student Activities',
    dress_code: 'Campus casual',
    tags: ['campus', 'community', 'students'],
    description: 'A more social version of the org fair with music, iced coffee, and rapid-fire club pitches.',
    creatorUsername: `${TEST_PREFIX}sydney`,
  },
  {
    title: 'Open Volleyball Run',
    category: 'sports',
    dateOffset: 14,
    start_time: '17:45',
    end_time: '19:15',
    location: 'Athletics Pavilion',
    location_address: 'Athletics Pavilion, Princess Anne, MD',
    organizer: 'Campus Rec League',
    dress_code: 'Athletic',
    tags: ['sports', 'community', 'wellness'],
    description: 'Drop in, rotate through teams, and meet people before the rest of the evening starts.',
    creatorUsername: `${TEST_PREFIX}kendrick`,
  },
];

const unique = (items) => [...new Set(items.filter(Boolean))];

const pickRealAnchors = (profiles) => {
  const picks = [];

  REAL_PROFILE_HINTS.forEach((hint) => {
    const match = profiles.find((profile) =>
      String(profile.username || '').toLowerCase().includes(hint)
    );

    if (match && !picks.some((profile) => profile.id === match.id)) {
      picks.push(match);
    }
  });

  profiles.forEach((profile) => {
    if (picks.length >= 3) return;
    if (!picks.some((pick) => pick.id === profile.id)) {
      picks.push(profile);
    }
  });

  return picks.slice(0, 3);
};

const ensureAuthUser = async (spec, existingUsersByEmail) => {
  const existingUser = existingUsersByEmail.get(spec.email);
  if (existingUser) {
    return existingUser;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: spec.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: spec.name,
      username: spec.username,
      interests: spec.interests,
      avatar_url: spec.avatar_url,
      phone_number: spec.phone_number,
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
};

const ensureProfiles = async (usersByUsername) => {
  const rows = TEST_USERS.map((spec) => {
    const user = usersByUsername.get(spec.username);

    return {
      id: user.id,
      name: spec.name,
      username: spec.username,
      bio: spec.bio,
      avatar_url: spec.avatar_url,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('profiles')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw error;
  }
};

const ensureEvents = async (usersByUsername) => {
  const fakeCreatorIds = TEST_USERS.map((spec) => usersByUsername.get(spec.username)?.id).filter(Boolean);

  const { data: existingEvents, error: existingEventsError } = await supabase
    .from('events')
    .select('id, title, created_by, event_date')
    .in('created_by', fakeCreatorIds);

  if (existingEventsError) {
    throw existingEventsError;
  }

  const existingByKey = new Map(
    (existingEvents || []).map((event) => [
      `${event.created_by}:${event.title}:${event.event_date}`,
      event,
    ])
  );

  const createdEvents = [];

  for (const spec of EVENT_SPECS) {
    const creator = usersByUsername.get(spec.creatorUsername);
    if (!creator) continue;

    const event_date = formatIsoDate(spec.dateOffset);
    const key = `${creator.id}:${spec.title}:${event_date}`;
    const existing = existingByKey.get(key);
    const payload = {
      title: spec.title,
      description: spec.description,
      location: spec.location,
      location_address: spec.location_address,
      date: formatDateLabel(event_date),
      event_date,
      start_time: spec.start_time,
      end_time: spec.end_time,
      organizer: spec.organizer,
      dress_code: spec.dress_code,
      image: EVENT_IMAGES[spec.category],
      tags: spec.tags,
      created_by: creator.id,
      creator_username: spec.creatorUsername,
      going_count: 1,
    };

    if (existing) {
      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      createdEvents.push(data);
      continue;
    }

    const { data, error } = await supabase
      .from('events')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    createdEvents.push(data);
  }

  return createdEvents;
};

const ensureRsvps = async (usersByUsername, events, realAnchors) => {
  const eventIds = events.map((event) => event.id);
  if (eventIds.length === 0) return;

  const fakeUserIds = TEST_USERS.map((spec) => usersByUsername.get(spec.username)?.id).filter(Boolean);

  const { data: existingRsvps, error } = await supabase
    .from('rsvps')
    .select('user_id, event_id')
    .in('event_id', eventIds);

  if (error) throw error;

  const existingKeys = new Set(
    (existingRsvps || []).map((row) => `${row.user_id}:${row.event_id}`)
  );

  const rows = [];

  events.forEach((event, index) => {
    const creatorId = event.created_by;
    const fakeAttendees = unique([
      creatorId,
      fakeUserIds[index % fakeUserIds.length],
      fakeUserIds[(index + 2) % fakeUserIds.length],
      fakeUserIds[(index + 4) % fakeUserIds.length],
      fakeUserIds[(index + 6) % fakeUserIds.length],
    ]);

    fakeAttendees.forEach((userId) => {
      const key = `${userId}:${event.id}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        rows.push({ user_id: userId, event_id: event.id });
      }
    });
  });

  realAnchors.forEach((profile, index) => {
    const targetEvents = events.slice(index, index + 2);
    targetEvents.forEach((event) => {
      const key = `${profile.id}:${event.id}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        rows.push({ user_id: profile.id, event_id: event.id });
      }
    });
  });

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('rsvps').insert(rows);
    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }
  }

  const counts = new Map();
  [...existingKeys].forEach((key) => {
    const [, eventId] = key.split(':');
    counts.set(eventId, (counts.get(eventId) || 0) + 1);
  });

  for (const event of events) {
    const nextCount = counts.get(event.id) || event.going_count || 0;
    await supabase
      .from('events')
      .update({ going_count: nextCount })
      .eq('id', event.id);
  }
};

const ensureFollows = async (usersByUsername, realAnchors) => {
  const { data: existingRows, error } = await supabase
    .from('follows')
    .select('follower_id, following_id');

  if (error) throw error;

  const existingKeys = new Set(
    (existingRows || []).map((row) => `${row.follower_id}:${row.following_id}`)
  );

  const rows = [];
  const fakeUsers = TEST_USERS.map((spec) => usersByUsername.get(spec.username)).filter(Boolean);

  fakeUsers.forEach((user, index) => {
    const firstTarget = fakeUsers[(index + 1) % fakeUsers.length];
    const secondTarget = fakeUsers[(index + 4) % fakeUsers.length];

    [firstTarget, secondTarget].forEach((target) => {
      if (!target || target.id === user.id) return;
      const key = `${user.id}:${target.id}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        rows.push({ follower_id: user.id, following_id: target.id });
      }
    });
  });

  realAnchors.forEach((profile, index) => {
    const fakeFollowers = [
      fakeUsers[index],
      fakeUsers[index + 4],
      fakeUsers[index + 8],
    ].filter(Boolean);

    fakeFollowers.forEach((follower) => {
      const key = `${follower.id}:${profile.id}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        rows.push({ follower_id: follower.id, following_id: profile.id });
      }
    });
  });

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('follows').insert(rows);
    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }
  }
};

const ensureMessages = async (usersByUsername, events, realAnchors) => {
  const participantIds = unique([
    ...TEST_USERS.map((spec) => usersByUsername.get(spec.username)?.id),
    ...realAnchors.map((profile) => profile.id),
  ]);

  const { data: existingRows, error } = await supabase
    .from('messages')
    .select('sender_id, recipient_id, content')
    .or(
      participantIds.map((id) => `sender_id.eq.${id}`).join(',')
    );

  if (error) {
    throw error;
  }

  const existingKeys = new Set(
    (existingRows || []).map(
      (row) => `${row.sender_id}:${row.recipient_id}:${row.content}`
    )
  );

  const fakeUsers = TEST_USERS.map((spec) => usersByUsername.get(spec.username)).filter(Boolean);
  const messages = [];

  const queueMessage = (senderId, recipientId, content) => {
    const key = `${senderId}:${recipientId}:${content}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    messages.push({
      sender_id: senderId,
      recipient_id: recipientId,
      content,
    });
  };

  fakeUsers.slice(0, 8).forEach((user, index) => {
    const recipient = fakeUsers[(index + 3) % fakeUsers.length];
    const event = events[index % events.length];
    queueMessage(
      user.id,
      recipient.id,
      `Are you pulling up to ${event.title}? I heard the crowd is going to be solid.`
    );
    queueMessage(
      recipient.id,
      user.id,
      `Yeah, I saved it already. Meet me near ${event.location}.`
    );
  });

  realAnchors.forEach((profile, index) => {
    const sender = fakeUsers[index % fakeUsers.length];
    const event = events[(index + 2) % events.length];
    queueMessage(
      sender.id,
      profile.id,
      `Test invite: ${event.title} is one of the seeded events if you want a quick mobile DM thread to test.`
    );
  });

  if (messages.length > 0) {
    const { error: insertError } = await supabase.from('messages').insert(messages);
    if (insertError) throw insertError;
  }
};

const main = async () => {
  console.log('Seeding mobile test community...');

  const { data: authUsersData, error: listUsersError } =
    await supabase.auth.admin.listUsers();

  if (listUsersError) throw listUsersError;

  const existingUsersByEmail = new Map(
    (authUsersData?.users || []).map((user) => [user.email, user])
  );

  const usersByUsername = new Map();

  for (const spec of TEST_USERS) {
    const user = await ensureAuthUser(spec, existingUsersByEmail);
    existingUsersByEmail.set(spec.email, user);
    usersByUsername.set(spec.username, user);
  }

  await ensureProfiles(usersByUsername);

  const { data: realProfiles, error: realProfilesError } = await supabase
    .from('profiles')
    .select('id, name, username')
    .not('username', 'ilike', `${TEST_PREFIX}%`);

  if (realProfilesError) throw realProfilesError;

  const realAnchors = pickRealAnchors(realProfiles || []);
  const events = await ensureEvents(usersByUsername);

  await ensureRsvps(usersByUsername, events, realAnchors);
  await ensureFollows(usersByUsername, realAnchors);
  await ensureMessages(usersByUsername, events, realAnchors);

  console.log(`Seed complete:
- ${TEST_USERS.length} fake users ensured
- ${events.length} fake events ensured
- ${realAnchors.length} real profiles lightly anchored with fake followers / RSVPs / DMs
- default password for fake users: ${TEST_PASSWORD}`);
};

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
