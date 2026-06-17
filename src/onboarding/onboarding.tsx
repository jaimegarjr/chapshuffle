import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getConsent, setConsent, subscribeConsent } from '../analytics/ConsentManager';
import { setAnalyticsNoticeDismissed } from '../analytics/AnalyticsNotice';

export const ONBOARDING_TEST_VIDEO_URL =
  'https://www.youtube.com/watch?v=pgQRcqh1u7U&si=4WQlXVnY1EqxFjFT';

export const ONBOARDING_LINKS = {
  feedback: 'https://forms.gle/n3ckHKVrPcsDWK6t5',
  support: 'https://ko-fi.com/jaimegarjr',
  privacy: 'https://jaimegarjr.github.io/chapshuffle/#privacy',
  homepage: 'https://jaimegarjr.github.io/chapshuffle/',
} as const;

export type OnboardingMode = 'install' | 'revisit';

interface CompletionDependencies {
  saveConsent(value: boolean): Promise<void>;
  dismissAnalyticsNotice(): Promise<void>;
  navigate(url: string): void;
}

interface OnboardingAppProps {
  navigate?: (url: string) => void;
}

export function getOnboardingMode(search: string): OnboardingMode {
  return new URLSearchParams(search).get('mode') === 'revisit' ? 'revisit' : 'install';
}

export async function completeOnboarding(
  consent: boolean,
  dependencies: CompletionDependencies = {
    saveConsent: setConsent,
    dismissAnalyticsNotice: setAnalyticsNoticeDismissed,
    navigate: (url) => window.location.replace(url),
  }
): Promise<void> {
  await dependencies.saveConsent(consent);
  await dependencies.dismissAnalyticsNotice();
  dependencies.navigate(ONBOARDING_TEST_VIDEO_URL);
}

export function OnboardingApp({ navigate }: OnboardingAppProps) {
  const [consent, setConsentState] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mode = getOnboardingMode(window.location.search);

  useEffect(() => {
    getConsent()
      .then((storedConsent) => {
        setConsentState(storedConsent);
        setReady(true);
      })
      .catch(() => {
        setError('Settings could not be loaded. Please reopen this page.');
      });
    return subscribeConsent(setConsentState);
  }, []);

  const handleConsentToggle = (event: Event) => {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    setConsentState(checked);
    void setConsent(checked);
    if (checked) void setAnalyticsNoticeDismissed();
  };

  const handleTry = async (): Promise<void> => {
    setSaving(true);
    setError('');
    try {
      await completeOnboarding(
        consent,
        navigate
          ? {
              saveConsent: setConsent,
              dismissAnalyticsNotice: setAnalyticsNoticeDismissed,
              navigate,
            }
          : undefined
      );
    } catch {
      setSaving(false);
      setError('Settings could not be saved. Please try again.');
    }
  };

  return (
    <main class="view-stage">
      <section class="onboarding-layout" aria-labelledby="onboarding-heading">
        <div class="hero onboarding-hero">
          <span class="hero-eyebrow">
            {mode === 'revisit' ? 'Getting started' : 'Welcome to Chap Shuffle'}
          </span>
          <h2 class="hero-title" id="onboarding-heading">
            {mode === 'revisit'
              ? 'Take another spin through the basics.'
              : 'Turn long videos into shuffled playlists.'}
          </h2>
          <p>
            Open a chaptered YouTube video, use the shuffle control in the player, and shape the
            queue like a playlist. The test video will walk you through the controls.
          </p>
        </div>

        <section class="onboarding-card" aria-labelledby="analytics-heading">
          <div>
            <span class="onboarding-card-kicker">Optional</span>
            <h2 id="analytics-heading">Help improve Chap Shuffle</h2>
            <p>
              Share pseudonymous feature usage and playback totals. Video titles, chapter names,
              browsing history, and personal information are never included.
            </p>
          </div>
          <label class="consent-control">
            <span>
              <strong>Share optional usage metrics</strong>
              <small>You can change this any time from the extension menu.</small>
            </span>
            <input
              aria-label="Share optional usage metrics"
              type="checkbox"
              checked={consent}
              disabled={!ready || saving}
              onChange={handleConsentToggle}
            />
            <span class="consent-slider" aria-hidden="true" />
          </label>
        </section>

        <div class="onboarding-actions">
          <button
            class="button button-primary"
            type="button"
            disabled={!ready || saving}
            onClick={() => void handleTry()}
          >
            {saving ? 'Opening YouTube…' : '▶ Try Chap Shuffle'}
          </button>
          <p class="onboarding-status" role="status">
            {error}
          </p>
        </div>

        <div class="cards onboarding-links" aria-label="More resources">
          <a
            class="card card-feedback"
            href={ONBOARDING_LINKS.feedback}
            target="_blank"
            rel="noopener"
          >
            <span class="card-title">✎ Share feedback</span>
            <span class="card-sub">Report bugs or request features in a quick form</span>
          </a>
          <a
            class="card card-donate"
            href={ONBOARDING_LINKS.support}
            target="_blank"
            rel="noopener"
          >
            <span class="card-title">
              <img class="card-icon" src="./assets/branding/icons/kofi.svg" alt="" />
              Support development
            </span>
            <span class="card-sub">ko-fi.com/jaimegarjr</span>
          </a>
          <a class="card" href={ONBOARDING_LINKS.privacy} target="_blank" rel="noopener">
            <span class="card-title">§ Privacy policy</span>
            <span class="card-sub">Review what optional analytics include</span>
          </a>
          <a class="card" href={ONBOARDING_LINKS.homepage} target="_blank" rel="noopener">
            <span class="card-title">Homepage</span>
            <span class="card-sub">Features, support, and project links</span>
          </a>
        </div>
      </section>
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<OnboardingApp />, root);
