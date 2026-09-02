import Link from 'next/link';
import { DecideFlow } from './DecideFlow';
import { IntentCard } from '../components/motion/IntentCard';
import { Logo } from '../components/Logo';
import { GuestDisclaimerGate } from '../components/GuestDisclaimerGate';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { FriendWelcomeBanner } from '../components/FriendWelcomeBanner';
import { SettingsMenu } from './SettingsMenu';
import { IMAGE_ASSETS } from '../lib/imageAssets';
import homeStyles from './home.module.css';

const SUPPORT_EMAIL = 'support@foodpadi.app';

interface HubAction {
  key: string;
  label: string;
  subtitle: string;
  icon?: string;
  href?: string;
  live: boolean;
  disabledTag?: string;
}

const SECONDARY_ACTIONS: HubAction[] = [
  { key: 'scan', icon: '/scan-food.png', label: 'Scan Food', subtitle: 'Food, ingredients or receipt', live: false, disabledTag: 'App only' },
];

export function HomeHub({
  guest = false,
  guestDisclaimerAcknowledged = false,
}: {
  guest?: boolean;
  guestDisclaimerAcknowledged?: boolean;
}) {
  return (
    <main className={homeStyles.container}>
      <div className={homeStyles.topBar}>
        <Logo href="/" size={36} />
        {/* Profile / Saved recipes / Log out + theme + subscription now live
            in this menu (upper-right) so the header stays to just the mark
            and one control. A guest has no account menu — just the way in. */}
        {guest ? (
          <span className={homeStyles.headerLinks}>
            <Link href="/login" className={homeStyles.logoutLink}>
              Log in
            </Link>
            <Link href="/register" className={homeStyles.logoutLink}>
              Create account
            </Link>
          </span>
        ) : (
          <SettingsMenu />
        )}
      </div>

      {!guest ? <FriendWelcomeBanner /> : null}
      <div className={homeStyles.header}>
        <h1 className={homeStyles.heading}>
          What should I eat?
          <span className={homeStyles.headingIcon} aria-hidden="true">🍽️</span>
        </h1>
      </div>
      <p className={homeStyles.subheading}>Tell FoodPadi what you&apos;re in the mood for, and we&apos;ll help you decide.</p>

      {/* On wide screens the Decide flow (primary) and the direct-mode cards +
          Scan (secondary) sit side by side so the page fills its width rather
          than running as one tall centred column; the grid collapses to a
          single stacked column below 900px. */}
      <div className={homeStyles.hubGrid}>
        <div className={homeStyles.hubMain}>
          {guest ? (
            <GuestDisclaimerGate acknowledged={guestDisclaimerAcknowledged}>
              <DecideFlow isGuest />
            </GuestDisclaimerGate>
          ) : (
            <DecideFlow />
          )}
        </div>

        <div className={homeStyles.hubAside}>
          <div className={homeStyles.primaryGrid}>
            <IntentCard
              href="/cook-today"
              badge="🥕"
              label="Cooking"
              subtitle="Use what I've got"
              image={IMAGE_ASSETS.cooking}
              accent="cooking"
            />
            <IntentCard
              href="/plan"
              badge="📅"
              label="Plan ahead"
              subtitle="Plan my meals"
              image={IMAGE_ASSETS.planAhead}
              accent="plan-ahead"
            />
          </div>

          <div className={homeStyles.secondaryRow}>
            {SECONDARY_ACTIONS.map((action) => (
              <span key={action.key} className={homeStyles.secondaryLink}>
                {action.icon ? (
                  action.icon.startsWith('/') ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny inline icon, no layout shift
                    <img src={action.icon} alt="" className={homeStyles.secondaryIcon} />
                  ) : (
                    <span aria-hidden="true">{action.icon} </span>
                  )
                ) : null}
                {action.label} · {action.subtitle}
                {action.disabledTag ? <span className={homeStyles.soonTag}>{action.disabledTag}</span> : null}
              </span>
            ))}
          </div>

          {guest ? (
            <MemberBenefitCard
              icon="✨"
              title="Make FoodPadi yours"
              body="Deciding what to eat and Cook Today work without an account. Create a free one and FoodPadi remembers your recipes, your preferences and your plans."
              ctaLabel="Create free account"
            />
          ) : (
            /* "Feed a Friend" nudge — food is social; invite someone who never
               knows what to eat (docs/REFERRAL_PLAN.md §2.5). */
            <div className={homeStyles.inviteCard}>
              <span className={homeStyles.inviteCardIcon} aria-hidden="true">🍽️</span>
              <div className={homeStyles.inviteCardBody}>
                <p className={homeStyles.inviteCardText}>
                  Know someone who always says &ldquo;I don&apos;t know what to eat&rdquo;?
                </p>
                <Link href="/invite" className={homeStyles.inviteCardLink}>
                  Invite a friend →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <a
        className={homeStyles.supportFab}
        href={`mailto:${SUPPORT_EMAIL}`}
        aria-label="Contact support"
        title="Contact support"
      >
        <svg
          className={homeStyles.supportFabIcon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H9l-4 3.5v-3.5H5.5C4.67 17 4 16.33 4 15.5v-10Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="8.5" cy="10.5" r="1" fill="currentColor" />
          <circle cx="12" cy="10.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="10.5" r="1" fill="currentColor" />
        </svg>
      </a>
    </main>
  );
}
