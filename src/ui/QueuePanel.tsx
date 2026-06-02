import { render } from 'preact';
import { useState } from 'preact/hooks';
import type { Chapter } from '../types';

const PANEL_ID = 'chapshuffle-queue';

export interface QueuePanelProps {
  chapters: Chapter[];
  allChapters: Chapter[];
  currentIndex: number;
  activeCount: number;
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

function GripIcon() {
  return (
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
      class="lucide lucide-grip-vertical"
    >
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  );
}

function ListXIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
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

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-x"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
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

function LoopIcon() {
  return (
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
      class="lucide lucide-repeat-2"
    >
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-shuffle"
    >
      <path d="m18 14 4 4-4 4" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.2-1.7l6.8-10.6C14.1 4.6 15.3 4 16.6 4H22" />
      <path d="M2 6h1.9c1.1 0 2.1.4 2.8 1.2" />
      <path d="M12.9 15.8c.7 1.3 2 2.2 3.5 2.2H22" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-skip-back"
    >
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" x2="5" y1="19" y2="5" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-skip-forward"
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" x2="19" y1="5" y2="19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-check"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function QueuePanel({
  chapters,
  allChapters,
  currentIndex,
  activeCount,
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
  const [isEditingExclusions, setIsEditingExclusions] = useState(false);
  const atStart = currentIndex === 0;
  const atEnd = currentIndex >= activeCount - 1;
  const hasExclusions = excludedSeconds.size > 0;
  const visibleChapters = isEditingExclusions ? allChapters : chapters;

  return (
    <div id={PANEL_ID} data-mode={isEditingExclusions ? 'exclusions' : 'queue'}>
      <div id="chapshuffle-queue-header">
        <span id="chapshuffle-queue-title">
          {isEditingExclusions ? 'Edit Exclusions' : 'Shuffle Queue'}
        </span>
      </div>
      <div id="chapshuffle-list">
        {visibleChapters.map((chapter, i) => {
          const isExcluded = excludedSeconds.has(chapter.startSeconds);
          const isPlayableRow = !isEditingExclusions;
          return (
            <div
              key={chapter.startSeconds}
              data-index={String(i)}
              draggable={isPlayableRow}
              aria-pressed={isEditingExclusions ? isExcluded : undefined}
              class={`chapshuffle-item${isPlayableRow && i === currentIndex ? ' chapshuffle-active' : ''}${isExcluded ? ' chapshuffle-excluded' : ''}${isEditingExclusions ? ' chapshuffle-exclusion-row' : ''}`}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                if (isEditingExclusions) {
                  onToggleExclusion(chapter.startSeconds);
                } else {
                  onSeek(i);
                }
              }}
              onDragStart={(e: DragEvent) => {
                if (!isPlayableRow) return;
                e.stopPropagation();
                e.dataTransfer?.setData('text/plain', String(i));
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e: DragEvent) => {
                if (!isPlayableRow) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e: DragEvent) => {
                if (!isPlayableRow) return;
                e.preventDefault();
                e.stopPropagation();
                const fromIndex = Number(e.dataTransfer?.getData('text/plain'));
                if (!Number.isInteger(fromIndex)) return;
                onReorder(fromIndex, i);
              }}
            >
              {isPlayableRow ? (
                <span class="chapshuffle-drag-handle" title="Drag to reorder" aria-hidden="true">
                  <GripIcon />
                </span>
              ) : (
                <span class="chapshuffle-exclusion-mark" aria-hidden="true">
                  {isExcluded ? <BanIcon /> : <CheckIcon />}
                </span>
              )}
              <span class="chapshuffle-title">{chapter.title}</span>
              <span class="chapshuffle-time">{secondsToTimestamp(chapter.startSeconds)}</span>
              {isEditingExclusions && (
                <span class="chapshuffle-exclusion-state">
                  {isExcluded ? 'Excluded' : 'Included'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!isEditingExclusions && (
        <div id="chapshuffle-progress-track">
          <div id="chapshuffle-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <div id="chapshuffle-queue-footer">
        {isEditingExclusions ? (
          <>
            <button
              id="chapshuffle-exclusion-done"
              class="chapshuffle-footer-btn chapshuffle-primary"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                setIsEditingExclusions(false);
              }}
            >
              <CheckIcon />
              <span>Done</span>
            </button>
            <button
              id="chapshuffle-clear-exclusions"
              class="chapshuffle-footer-btn"
              disabled={!hasExclusions}
              title="Clear all exclusions"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onClearExclusions();
              }}
            >
              <XIcon />
              <span>Clear</span>
            </button>
          </>
        ) : (
          <>
            <button
              id="chapshuffle-loop"
              class="chapshuffle-footer-btn"
              aria-pressed={loopMode}
              title={loopMode ? 'Loop: on - click to disable' : 'Loop: off - click to enable'}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onLoopToggle();
              }}
            >
              <LoopIcon />
            </button>
            <button
              class="chapshuffle-nav-btn"
              disabled={atStart}
              title="Previous chapter"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onPrev();
              }}
            >
              <SkipBackIcon />
            </button>
            <button
              id="chapshuffle-reshuffle"
              class="chapshuffle-footer-btn chapshuffle-primary"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onReshuffle();
              }}
            >
              <ShuffleIcon />
              <span>Reshuffle</span>
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
              <SkipForwardIcon />
            </button>
            <button
              id="chapshuffle-edit-exclusions"
              class="chapshuffle-footer-btn"
              title="Edit exclusions"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                setIsEditingExclusions(true);
              }}
            >
              <ListXIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function renderQueuePanel(container: Element, props: QueuePanelProps): void {
  render(<QueuePanel {...props} />, container);
}

export function unmountQueuePanel(container: Element): void {
  render(null, container);
}
