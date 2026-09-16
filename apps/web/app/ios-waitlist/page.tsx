import Link from 'next/link';
import { Logo } from '../../components/Logo';
import { TryFoodPadiButton } from '../TryFoodPadiButton';
import { WaitlistForm } from '../WaitlistForm';
import styles from '../page.module.css';

export const metadata = { title: 'iOS Waitlist — FoodPadi' };

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Android is the launch platform (launch brief §11); this is the "coming
// soon" landing for iPhone visitors — reuses WaitlistForm as-is (same
// consent/attribution machinery as the generic waitlist on the homepage,
// just a distinct purpose value) rather than a second signup implementation.
// Deliberately doesn't make an iPhone visitor feel blocked (§29): the "Try
// FoodPadi on the web now" escape hatch is right here, not buried.
export default function IosWaitlistPage({
  searchParams,
}: {
  searchParams?: { source?: string | string[]; campaign?: string | string[] };
}) {
  const source = firstParam(searchParams?.source);
  const campaign = firstParam(searchParams?.campaign);

  return (
    <main className={styles.main}>
      <Logo href="/" size={38} />
      <section className={styles.section} style={{ marginTop: 48 }}>
        <div className={styles.closingBlock}>
          <h1 className={styles.sectionHeading}>FoodPadi for iPhone is coming.</h1>
          <p className={styles.sectionSubtext}>
            Join the waitlist and we&apos;ll let you know the moment FoodPadi is ready for iOS.
          </p>
          <WaitlistForm
            purpose="ios_waitlist"
            source={source}
            campaign={campaign}
            submitLabel="Join the iOS Waitlist"
            doneMessage="You're on the iOS waitlist — we'll email you the moment it's ready."
          />
          <p className={styles.waitlistLead}>Don&apos;t want to wait?</p>
          <TryFoodPadiButton className={styles.waitlistButton}>
            Try FoodPadi on the web now
          </TryFoodPadiButton>
        </div>
      </section>
    </main>
  );
}
