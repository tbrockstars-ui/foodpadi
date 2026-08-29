'use client';

import { useEffect, useState } from 'react';
import type { FoodProviderResult, LocalFoodSearchResponse } from '@foodpadi/shared';
import { SearchingNearby } from '../../components/motion/SearchingNearby';
import styles from './eat-now.module.css';

export type LocalFoodSearchStage =
  | 'idle' // "Find it nearby" not yet pressed
  | 'asking-permission' // requesting browser geolocation
  | 'manual-location' // permission denied/unsupported/failed — asking for postcode/town
  | 'searching'
  | 'results'
  | 'no-results'
  | 'error';

function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Real, location-aware "find this food near me" — a supporting capability of
 * Eat Now, not a restaurant browser (docs/IMPLEMENTATION_PLAN.md). Kept as a
 * separate section below the existing illustrative catalog search rather
 * than replacing it, since that search is honestly labelled as illustrative
 * and still useful with no location at all.
 */
export function LocalFoodSearch({
  query,
  autoStart = false,
  onStageChange,
}: {
  query: string;
  autoStart?: boolean;
  /** Lets a parent (e.g. DecideFlow) know when a search is actively in
   * progress, so it can e.g. hide a "collapse this" toggle mid-search
   * rather than let it interrupt something already underway. */
  onStageChange?: (stage: LocalFoodSearchStage) => void;
}) {
  const [stage, setStage] = useState<LocalFoodSearchStage>(autoStart ? 'asking-permission' : 'idle');

  useEffect(() => {
    onStageChange?.(stage);
    // onStageChange is expected to be a stable callback (or the caller
    // should memoize it) — re-running only on stage change is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  const [manualLocation, setManualLocation] = useState('');
  const [results, setResults] = useState<FoodProviderResult[]>([]);
  const [source, setSource] = useState<LocalFoodSearchResponse['source']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Distinguishes "browser has this site's location permission blocked"
  // (PERMISSION_DENIED) from "couldn't get a fix in time" / "unavailable" —
  // once a site is blocked, the browser never shows the prompt again and
  // getCurrentPosition just fails silently every time, so without this the
  // manual-location fallback looked identical (and equally unexplained) for
  // a one-off GPS timeout and for "you'll never get a prompt again until you
  // fix this in your browser's site settings".
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const runSearch = async (body: { latitude?: number; longitude?: number; locationText?: string }) => {
    setStage('searching');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/proxy/local-food-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), ...body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        // The API's own messages are already user-facing and specific
        // ("couldn't reach the data source", "couldn't find that location",
        // …) — prefer them, and only fall back to a generic line if the
        // response carried none.
        setErrorMessage(message ?? "We couldn't find nearby food right now. Please try again.");
        setStage('error');
        return;
      }
      const data = (await res.json()) as LocalFoodSearchResponse;
      setResults(data.results);
      setSource(data.source);
      setStage(data.results.length > 0 ? 'results' : 'no-results');
    } catch {
      setErrorMessage("We couldn't find nearby food right now. Please try again.");
      setStage('error');
    }
  };

  const findNearby = () => {
    if (!query.trim()) return;
    if (!isGeolocationSupported()) {
      setStage('manual-location');
      return;
    }
    setStage('asking-permission');
    setPermissionBlocked(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        runSearch({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        // Denied, unavailable, or timed out — never block the user, offer
        // the manual fallback instead (section 3 of the brief). PERMISSION_DENIED
        // specifically means the browser has this site blocked and will keep
        // silently failing forever without ever re-prompting — worth telling
        // the user that directly, since "try again" won't help on its own.
        setPermissionBlocked(error.code === error.PERMISSION_DENIED);
        setStage('manual-location');
      },
      { timeout: 10_000 },
    );
  };

  const searchManualLocation = () => {
    const trimmed = manualLocation.trim();
    if (!trimmed) return;
    runSearch({ locationText: trimmed });
  };

  // Skip the "press this button to search" step entirely when the caller
  // (e.g. DecideFlow's "Find it nearby" on a Get it option) already
  // represents a user click that means "search now" — go straight to asking
  // for location instead of asking the user to confirm the same intent twice.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (autoStart) findNearby();
  }, []);

  return (
    <div className={styles.nearbySection}>
      {!autoStart ? (
        <>
          <h2 className={styles.nearbyHeading}>Find it near you</h2>
          <p className={styles.nearbySubtitle}>
            FoodPadi uses your location to find nearby places that actually offer what you&apos;re after —
            real businesses, not a browse list.
          </p>
        </>
      ) : null}

      {!autoStart && (stage === 'idle' || stage === 'asking-permission') ? (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={findNearby}
          disabled={!query.trim() || stage === 'asking-permission'}
        >
          {stage === 'asking-permission' ? 'Getting your location…' : '📍 Find it nearby'}
        </button>
      ) : null}

      {autoStart && stage === 'asking-permission' ? <SearchingNearby label="Getting your location…" /> : null}

      {stage === 'manual-location' ? (
        <div className={styles.locationBox}>
          {permissionBlocked ? (
            <p className={styles.locationBoxText}>
              Your browser has location access blocked for this site, so it won&apos;t prompt you again on its
              own — open the site settings (usually the lock or ⓘ icon by the address bar), allow
              Location, then reload. Or just enter a postcode, town, or area below.
            </p>
          ) : (
            <p className={styles.locationBoxText}>
              FoodPadi needs a location to find food nearby. Enter a postcode, town, or area instead.
            </p>
          )}
          <div className={styles.manualLocationRow}>
            <input
              className={styles.manualLocationInput}
              type="text"
              placeholder="e.g. SW1A 1AA or Leicester"
              value={manualLocation}
              onChange={(e) => setManualLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchManualLocation()}
            />
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={searchManualLocation}
              disabled={!manualLocation.trim()}
            >
              Search
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'searching' ? <SearchingNearby /> : null}

      {stage === 'error' ? (
        <div className={styles.locationBox}>
          <p className={styles.locationBoxText}>{errorMessage}</p>
          <div className={styles.buttonRow}>
            <button type="button" className={styles.secondaryButton} onClick={findNearby}>
              Try again
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setStage('manual-location')}>
              Enter postcode
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'no-results' ? (
        <div className={styles.locationBox}>
          <p className={styles.locationBoxText}>We couldn&apos;t find a strong match nearby.</p>
          <button type="button" className={styles.secondaryButton} onClick={() => setStage('manual-location')}>
            Try a different location
          </button>
        </div>
      ) : null}

      {stage === 'results' ? (
        <>
          {source === 'openstreetmap' ? (
            <p className={styles.attributionNote} translate="no">
              Results from OpenStreetMap · © OpenStreetMap contributors
            </p>
          ) : null}
          {results.map((provider) => (
            <div key={provider.id} className={styles.providerCard}>
              <p className={styles.providerName}>{provider.name}</p>
              <p
                className={`${styles.matchBadge} ${
                  provider.matchType === 'EXACT_MATCH' ? styles.matchBadgeExact : styles.matchBadgeClose
                }`}
              >
                {provider.matchType === 'EXACT_MATCH' ? `✓ ${provider.matchedFood}` : `~ ${provider.matchedFood}`}
                {provider.matchType === 'CLOSE_MATCH' ? ' · Close match' : ''}
              </p>
              {provider.distanceText ? <p className={styles.providerMeta}>{provider.distanceText}</p> : null}
              {provider.address ? <p className={styles.providerMeta}>{provider.address}</p> : null}
              {provider.phone ? <p className={styles.providerMeta}>{provider.phone}</p> : null}

              <div className={styles.providerActions}>
                {provider.bookingUrl ? (
                  <a className={styles.providerActionLink} href={provider.bookingUrl} target="_blank" rel="noopener noreferrer">
                    Book now
                  </a>
                ) : null}
                {provider.orderUrl ? (
                  <a className={styles.providerActionLink} href={provider.orderUrl} target="_blank" rel="noopener noreferrer">
                    Order online
                  </a>
                ) : null}
                {provider.phone ? (
                  <a className={styles.providerActionLink} href={`tel:${provider.phone}`}>
                    Call now
                  </a>
                ) : null}
                {provider.websiteUrl ? (
                  <a className={styles.providerActionLink} href={provider.websiteUrl} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                ) : null}
                {provider.mapsUrl ? (
                  <a className={styles.providerActionLink} href={provider.mapsUrl} target="_blank" rel="noopener noreferrer">
                    Maps
                  </a>
                ) : null}
                {/* Below: honest search links, not verified data — clearly
                    distinguished by style and a 🔍 prefix so they're never
                    mistaken for a real phone/website/order link we found for
                    this specific business. Always offered, since OSM's own
                    tag coverage varies a lot business to business. */}
                <a
                  className={styles.providerSearchLink}
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${provider.name} ${provider.address ?? ''}`.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🔍 Search the web
                </a>
                <a
                  className={styles.providerSearchLink}
                  href={`https://www.ubereats.com/search?q=${encodeURIComponent(provider.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🔍 Search Uber Eats
                </a>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
