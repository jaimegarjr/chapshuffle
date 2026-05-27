import { render } from 'preact';
import type { Chapter } from '../types';

const PANEL_ID = 'chapshuffle-queue';

interface QueuePanelProps {
  chapters: Chapter[];
  currentIndex: number;
  onSeek: (index: number) => void;
  onReshuffle: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function secondsToTimestamp(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function QueuePanel({
  chapters,
  currentIndex,
  onSeek,
  onReshuffle,
  onPrev,
  onNext,
}: QueuePanelProps) {
  const atStart = currentIndex === 0;
  const atEnd = currentIndex === chapters.length - 1;
  return (
    <div id={PANEL_ID}>
      <div id="chapshuffle-queue-header">
        <span id="chapshuffle-queue-title">Shuffle Queue</span>
        <div id="chapshuffle-nav">
          <button
            class="chapshuffle-nav-btn"
            disabled={atStart}
            title="Previous chapter"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              onPrev();
            }}
          >
            &#8592;
          </button>
          <button
            class="chapshuffle-nav-btn"
            disabled={atEnd}
            title="Next chapter"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              onNext();
            }}
          >
            &#8594;
          </button>
        </div>
        <button
          id="chapshuffle-reshuffle"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onReshuffle();
          }}
        >
          ⇄ Reshuffle
        </button>
      </div>
      {chapters.map((chapter, i) => (
        <div
          key={chapter.startSeconds}
          data-index={String(i)}
          class={`chapshuffle-item${i === currentIndex ? ' chapshuffle-active' : ''}`}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onSeek(i);
          }}
        >
          <span class="chapshuffle-title">{chapter.title}</span>
          <span class="chapshuffle-time">{secondsToTimestamp(chapter.startSeconds)}</span>
        </div>
      ))}
    </div>
  );
}

export function renderQueuePanel(container: Element, props: QueuePanelProps): void {
  render(<QueuePanel {...props} />, container);
}

export function unmountQueuePanel(container: Element): void {
  render(null, container);
}
