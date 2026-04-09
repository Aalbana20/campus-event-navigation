import React from 'react';

import { InboxScreen } from '@/components/mobile/InboxScreen';

export default function MessagesRoute() {
  return (
    <InboxScreen
      initialTab="dms"
      lockedTab="dms"
      showBackButton={false}
      title="DMs"
      subtitle="Conversations around your campus plans live here."
    />
  );
}
