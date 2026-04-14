import { supabase } from '@/lib/supabase';

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
};

export const sendPushToUser = async (
  recipientId: string,
  title: string,
  body: string
): Promise<void> => {
  if (!supabase || !recipientId) return;

  try {
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientId);

    if (error || !tokens?.length) return;

    const messages: ExpoPushMessage[] = tokens.map((row) => ({
      to: row.token as string,
      sound: 'default',
      title,
      body,
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('Unable to send push notification:', err);
  }
};
