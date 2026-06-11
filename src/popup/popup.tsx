import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {
  DEFAULT_SETTINGS,
  settings,
  type QueueEndBehavior,
} from '../persistence/PersistenceManager';
import { getConsent, setConsent, subscribeConsent } from '../analytics/ConsentManager';
import { analyticsReporter } from '../analytics/AnalyticsReporter';

export const POPUP_LINKS = {
  feedback: 'https://forms.gle/1Sa7R5roqwko2suSA',
  gettingStarted: 'https://jaimegarjr.github.io/chapshuffle/',
  privacy: 'https://jaimegarjr.github.io/chapshuffle/#privacy',
  homepage: 'https://jaimegarjr.github.io/chapshuffle/',
} as const;

export function App() {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.shuffleEnabled);
  const [minChapters, setMinChaptersState] = useState(DEFAULT_SETTINGS.minChapters);
  const [queueEnd, setQueueEndState] = useState<QueueEndBehavior>(
    DEFAULT_SETTINGS.queueEndBehavior
  );
  const [consent, setConsentState] = useState(false);

  useEffect(() => {
    settings.read().then((initialSettings) => {
      setEnabled(initialSettings.shuffleEnabled);
      setMinChaptersState(initialSettings.minChapters);
      setQueueEndState(initialSettings.queueEndBehavior);
    });
    getConsent().then(setConsentState);
    return subscribeConsent(setConsentState);
  }, []);

  const handleToggle = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setEnabled(checked);
    settings.update({ shuffleEnabled: checked });
  };

  const handleStepper = (delta: number) => {
    const next = Math.min(10, Math.max(2, minChapters + delta));
    setMinChaptersState(next);
    settings.update({ minChapters: next });
  };

  const handleQueueEnd = (value: QueueEndBehavior) => {
    setQueueEndState(value);
    settings.update({ queueEndBehavior: value });
  };

  const handleConsentToggle = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setConsentState(checked);
    setConsent(checked);
  };

  const openLink = async (url: string, trackFeedback = false): Promise<void> => {
    if (trackFeedback) {
      await analyticsReporter.notifyFeedbackLinkOpened();
    }
    chrome.tabs.create({ url });
  };

  return (
    <div>
      <header class="header">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#cc0000"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m18 14 4 4-4 4" />
          <path d="m18 2 4 4-4 4" />
          <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
          <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
          <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
        </svg>
        <span class="title">ChapShuffle</span>
      </header>

      <div class="settings">
        <section class="section" aria-labelledby="playback-heading">
          <h2 id="playback-heading" class="section-title">
            Playback
          </h2>
          <div class="row">
            <div class="label-group">
              <span class="label">Auto-advance</span>
              <span class="sublabel">Play chapters in shuffled queue order</span>
            </div>
            <label class="switch">
              <input
                aria-label="Auto-advance"
                type="checkbox"
                checked={enabled}
                onChange={handleToggle}
              />
              <span class="slider" />
            </label>
          </div>

          <div class="row">
            <div class="label-group">
              <span class="label">Min. chapters</span>
              <span class="sublabel">Activate on videos with at least N chapters</span>
            </div>
            <div class="stepper">
              <button
                class="step-btn"
                disabled={minChapters <= 2}
                onClick={() => handleStepper(-1)}
              >
                −
              </button>
              <span class="step-value">{minChapters}</span>
              <button
                class="step-btn"
                disabled={minChapters >= 10}
                onClick={() => handleStepper(1)}
              >
                +
              </button>
            </div>
          </div>

          <div class="row row-col">
            <div class="label-group">
              <span class="label">When queue ends</span>
              <span class="sublabel">What happens after the last chapter plays</span>
            </div>
            <div class="segmented">
              <button
                class={`seg-btn${queueEnd === 'reshuffle' ? ' seg-active' : ''}`}
                onClick={() => handleQueueEnd('reshuffle')}
              >
                Reshuffle
              </button>
              <button
                class={`seg-btn${queueEnd === 'end-video' ? ' seg-active' : ''}`}
                onClick={() => handleQueueEnd('end-video')}
              >
                End video
              </button>
            </div>
          </div>

          <p class="hint">
            Click the <strong>shuffle icon</strong> in the YouTube player on any video with{' '}
            {minChapters}+ chapters.
          </p>
        </section>

        <section class="section" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" class="section-title">
            Privacy
          </h2>
          <div class="row">
            <div class="label-group">
              <span class="label">Share anonymous usage metrics</span>
              <span class="sublabel">
                No video titles or personal data — helps improve ChapShuffle
              </span>
            </div>
            <label class="switch">
              <input
                aria-label="Share anonymous usage metrics"
                type="checkbox"
                checked={consent}
                onChange={handleConsentToggle}
              />
              <span class="slider" />
            </label>
          </div>
        </section>

        <section class="section" aria-labelledby="help-heading">
          <h2 id="help-heading" class="section-title">
            Help
          </h2>
          <div class="help-links">
            <button class="help-link" onClick={() => void openLink(POPUP_LINKS.feedback, true)}>
              <span>
                <strong>Send feedback</strong>
                <small>Share an idea or report a problem</small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
            <button class="help-link" onClick={() => void openLink(POPUP_LINKS.gettingStarted)}>
              <span>Getting started</span>
              <span aria-hidden="true">↗</span>
            </button>
            <button class="help-link" onClick={() => void openLink(POPUP_LINKS.privacy)}>
              <span>Privacy policy</span>
              <span aria-hidden="true">↗</span>
            </button>
            <button class="help-link" onClick={() => void openLink(POPUP_LINKS.homepage)}>
              <span>Homepage</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
