import { render } from 'preact';
import type { Chapter } from '../types';

const PANEL_ID = 'chapshuffle-queue';

export interface QueuePanelProps {
  chapters: Chapter[];
  currentIndex: number;
  progress: number;
  loopMode: boolean;
  excludedSeconds: Set<number>;
  onSeek: (index: number) => void;
  onReshuffle: () => void;
  onLoopToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleExclusion: (startSeconds: number) => void;
  onClearExclusions: () => void;
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

function BanIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-ban"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

function ListXIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-list-x"
    >
      <path d="M11 12H3" />
      <path d="M16 6H3" />
      <path d="M16 18H3" />
      <path d="m19 10-4 4" />
      <path d="m15 10 4 4" />
    </svg>
  );
}

function QueuePanel({
  chapters,
  currentIndex,
  progress,
  loopMode,
  excludedSeconds,
  onSeek,
  onReshuffle,
  onLoopToggle,
  onPrev,
  onNext,
  onReorder,
  onToggleExclusion,
  onClearExclusions,
}: QueuePanelProps) {
  const atStart = currentIndex === 0;
  const atEnd = currentIndex === chapters.length - 1;
  const hasExclusions = excludedSeconds.size > 0;
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
        {hasExclusions && (
          <button
            id="chapshuffle-clear-exclusions"
            title="Clear all exclusions"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              onClearExclusions();
            }}
          >
            <ListXIcon />
          </button>
        )}
        <button
          id="chapshuffle-loop"
          aria-pressed={loopMode}
          title={loopMode ? 'Loop: on — click to disable' : 'Loop: off — click to enable'}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onLoopToggle();
          }}
          style={{ color: loopMode ? '#f00' : undefined }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
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
      {chapters.map((chapter, i) => {
        const isExcluded = excludedSeconds.has(chapter.startSeconds);
        return (
          <div
            key={chapter.startSeconds}
            data-index={String(i)}
            draggable={!isExcluded}
            class={`chapshuffle-item${i === currentIndex ? ' chapshuffle-active' : ''}${isExcluded ? ' chapshuffle-excluded' : ''}`}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              if (!isExcluded) onSeek(i);
            }}
            onDragStart={(e: DragEvent) => {
              if (isExcluded) return;
              e.stopPropagation();
              e.dataTransfer?.setData('text/plain', String(i));
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e: DragEvent) => {
              if (isExcluded) return;
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e: DragEvent) => {
              if (isExcluded) return;
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
            <button
              class="chapshuffle-ban"
              title={isExcluded ? 'Re-include chapter' : 'Exclude chapter from shuffle'}
              aria-pressed={isExcluded}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onToggleExclusion(chapter.startSeconds);
              }}
            >
              <BanIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function renderQueuePanel(container: Element, props: QueuePanelProps): void {
  render(<QueuePanel {...props} />, container);
}

export function unmountQueuePanel(container: Element): void {
  render(null, container);
}
