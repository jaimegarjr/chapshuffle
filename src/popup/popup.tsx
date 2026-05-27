import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {
  getShuffleEnabled,
  setShuffleEnabled,
  getMinChapters,
  setMinChapters,
  getQueueEndBehavior,
  setQueueEndBehavior,
  type QueueEndBehavior,
} from '../persistence/PersistenceManager';

function App() {
  const [enabled, setEnabled] = useState(false);
  const [minChapters, setMinChaptersState] = useState(5);
  const [queueEnd, setQueueEndState] = useState<QueueEndBehavior>('reshuffle');

  useEffect(() => {
    Promise.all([getShuffleEnabled(), getMinChapters(), getQueueEndBehavior()]).then(
      ([en, min, qe]) => {
        setEnabled(en);
        setMinChaptersState(min);
        setQueueEndState(qe);
      }
    );
  }, []);

  const handleToggle = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setEnabled(checked);
    setShuffleEnabled(checked);
  };

  const handleStepper = (delta: number) => {
    const next = Math.min(10, Math.max(2, minChapters + delta));
    setMinChaptersState(next);
    setMinChapters(next);
  };

  const handleQueueEnd = (value: QueueEndBehavior) => {
    setQueueEndState(value);
    setQueueEndBehavior(value);
  };

  return (
    <div>
      <header class="header">
        <span class="logo">⇄</span>
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
        Click <strong>⇄</strong> in the YouTube player on any video with {minChapters}+ chapters.
      </p>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
