import { render } from 'preact';
import type { Chapter } from '../types';

const PANEL_ID = 'chapshuffle-queue';

export interface QueuePanelProps {
  chapters: Chapter[];
  currentIndex: number;
  progress: number;
  onSeek: (index: number) => void;
  onReshuffle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
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
  progress,
  onSeek,
  onReshuffle,
  onPrev,
  onNext,
  onReorder,
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
      <div id="chapshuffle-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
      {chapters.map((chapter, i) => (
        <div
          key={chapter.startSeconds}
          data-index={String(i)}
          draggable
          class={`chapshuffle-item${i === currentIndex ? ' chapshuffle-active' : ''}`}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onSeek(i);
          }}
          onDragStart={(e: DragEvent) => {
            e.stopPropagation();
            e.dataTransfer?.setData('text/plain', String(i));
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const fromIndex = Number(e.dataTransfer?.getData('text/plain'));
            if (!Number.isInteger(fromIndex)) return;
            onReorder(fromIndex, i);
          }}
        >
          <span class="chapshuffle-drag-handle" title="Drag to reorder" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-grip-vertical-icon lucide-grip-vertical"
            >
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </span>
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
