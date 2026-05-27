import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { getShuffleEnabled, setShuffleEnabled } from '../persistence/PersistenceManager';

function App() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getShuffleEnabled().then(setEnabled);
  }, []);

  const handleChange = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setEnabled(checked);
    setShuffleEnabled(checked);
  };

  return (
    <div>
      <div class="header">
        <span class="logo">⇄</span>
        <span class="title">ChapShuffle</span>
      </div>
      <div class="row">
        <div class="label">
          Enable shuffle
          <div class="sublabel">Auto-advance through shuffled chapters</div>
        </div>
        <label class="switch">
          <input type="checkbox" checked={enabled} onChange={handleChange} />
          <span class="slider"></span>
        </label>
      </div>
      <p class="hint">
        On a YouTube video with 5+ chapters, click <strong>⇄</strong> in the player controls to open
        the shuffle queue.
      </p>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
