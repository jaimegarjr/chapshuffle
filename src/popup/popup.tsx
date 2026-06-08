import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {
  DEFAULT_SETTINGS,
  settings,
  type QueueEndBehavior,
} from '../persistence/PersistenceManager';

function App() {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.shuffleEnabled);
  const [minChapters, setMinChaptersState] = useState(DEFAULT_SETTINGS.minChapters);
  const [queueEnd, setQueueEndState] = useState<QueueEndBehavior>(
    DEFAULT_SETTINGS.queueEndBehavior
  );

  useEffect(() => {
    settings.read().then((initialSettings) => {
      setEnabled(initialSettings.shuffleEnabled);
      setMinChaptersState(initialSettings.minChapters);
      setQueueEndState(initialSettings.queueEndBehavior);
    });
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
        <div class="row">
          <div class="label-group">
            <span class="label">Enable shuffle</span>
            <span class="sublabel">Auto-advance through shuffled chapters</span>
          </div>
          <label class="switch">
            <input type="checkbox" checked={enabled} onChange={handleToggle} />
            <span class="slider" />
          </label>
        </div>

        <div class="row">
          <div class="label-group">
            <span class="label">Min. chapters</span>
            <span class="sublabel">Activate on videos with at least N chapters</span>
          </div>
          <div class="stepper">
            <button class="step-btn" disabled={minChapters <= 2} onClick={() => handleStepper(-1)}>
              −
            </button>
            <span class="step-value">{minChapters}</span>
            <button class="step-btn" disabled={minChapters >= 10} onClick={() => handleStepper(1)}>
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
      </div>

      <p class="hint">
        Click the <strong>shuffle icon</strong> in the YouTube player on any video with{' '}
        {minChapters}+ chapters.
      </p>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
