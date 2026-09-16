'use client';

import type { DealerContactView } from '@foodpadi/shared';
import styles from './dealer.module.css';

// Only the channels the dealer actually supplied are rendered — nothing is
// fabricated (dealer brief §27). Each click records an aggregate, no-PII event.
export function DealerContactActions({
  slug,
  contact,
  locality,
}: {
  slug: string;
  contact: DealerContactView;
  locality: string | null;
}) {
  const track = (type: string) => {
    void fetch(`/api/proxy/dealers/${slug}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }).catch(() => undefined);
  };

  const directionsHref = locality
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locality)}`
    : null;

  return (
    <div className={styles.actions}>
      {contact.phone ? (
        <a className={styles.action} href={`tel:${contact.phone}`} onClick={() => track('phone_click')}>
          Call
        </a>
      ) : null}
      {contact.websiteUrl ? (
        <a
          className={styles.action}
          href={contact.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('website_click')}
        >
          Website
        </a>
      ) : null}
      {contact.orderUrl ? (
        <a
          className={styles.action}
          href={contact.orderUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('order_click')}
        >
          Order
        </a>
      ) : null}
      {contact.whatsappUrl ? (
        <a
          className={styles.action}
          href={contact.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('order_click')}
        >
          WhatsApp
        </a>
      ) : null}
      {directionsHref ? (
        <a
          className={styles.action}
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('direction_click')}
        >
          Get directions
        </a>
      ) : null}
    </div>
  );
}
