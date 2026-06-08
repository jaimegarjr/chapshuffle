export const PANEL_WIDTH_PX = 360;
export const PANEL_FADE_MS = 160;

export const CHAPSHUFFLE_CSS = `
  #chapshuffle-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 0 8px;
    opacity: 0.85;
    vertical-align: middle;
    display: inline-flex;
    align-items: center;
    position: relative;
  }
  #chapshuffle-btn:hover { opacity: 1; }
  #chapshuffle-btn[aria-expanded="true"] { opacity: 1; color: #f00; }
  .chapshuffle-shuffle-badge {
    display: none;
    position: absolute;
    bottom: 1px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.55);
    line-height: 1;
    pointer-events: none;
    white-space: nowrap;
  }
  #chapshuffle-btn[data-shuffle-off="true"] .chapshuffle-shuffle-badge {
    display: block;
  }

  #chapshuffle-queue {
    --chapshuffle-header-height: 44px;
    --chapshuffle-footer-height: 48px;
    --chapshuffle-row-height: 36px;
    position: fixed;
    top: auto;
    right: 24px;
    width: ${PANEL_WIDTH_PX}px;
    display: flex;
    flex-direction: column;
    max-height: min(
      calc(
        var(--chapshuffle-header-height) + var(--chapshuffle-footer-height) +
        (var(--chapshuffle-row-height) * 10) + 4px
      ),
      calc(100vh - 160px)
    );
    overflow: hidden;
    background: rgba(15, 15, 15, 0.93);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 0;
    z-index: 2147483647;
    color: #fff;
    font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
    font-size: 13px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.65);
    opacity: 1;
    transition: opacity ${PANEL_FADE_MS}ms ease;
  }
  #chapshuffle-queue,
  #chapshuffle-queue * {
    box-sizing: border-box;
  }
  #chapshuffle-queue.chapshuffle-fading-out {
    opacity: 0;
    pointer-events: none;
  }

  #chapshuffle-queue-header {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--chapshuffle-header-height);
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    gap: 8px;
    position: sticky;
    top: 0;
    z-index: 1;
    background: #0f0f0f;
    border-radius: 10px 10px 0 0;
    box-shadow: 0 1px 0 rgba(255,255,255,0.1);
  }
  #chapshuffle-queue-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.55;
    flex: 1;
    text-align: center;
  }
  #chapshuffle-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-color: rgba(255,255,255,0.25) transparent;
  }
  #chapshuffle-list::-webkit-scrollbar { width: 8px; }
  #chapshuffle-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.22);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  #chapshuffle-progress-track {
    flex: 0 0 3px;
    background: rgba(255,255,255,0.1);
  }
  #chapshuffle-progress {
    height: 100%;
    background: #f00;
    transition: width 0.25s linear;
  }
  #chapshuffle-nav {
    display: contents;
  }
  #chapshuffle-queue-footer {
    display: grid;
    grid-template-columns: minmax(32px, 1fr) 32px auto 32px minmax(32px, 1fr);
    align-items: center;
    gap: 4px;
    min-height: var(--chapshuffle-footer-height);
    padding: 7px 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
    background: #0f0f0f;
    border-radius: 0 0 10px 10px;
    box-shadow: 0 -1px 0 rgba(255,255,255,0.08);
  }
  .chapshuffle-footer-btn,
  .chapshuffle-nav-btn {
    background: none;
    border: 1px solid transparent;
    color: #fff;
    font: inherit;
    font-size: 12px;
    height: 32px;
    min-width: 32px;
    padding: 0 8px;
    cursor: pointer;
    opacity: 0.7;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: opacity 0.1s, color 0.1s, background 0.1s, border-color 0.1s;
  }
  .chapshuffle-footer-btn:hover:not(:disabled),
  .chapshuffle-nav-btn:hover:not(:disabled) { opacity: 1; background: rgba(255,255,255,0.1); }
  .chapshuffle-footer-btn:disabled,
  .chapshuffle-nav-btn:disabled { opacity: 0.25; cursor: default; }
  .chapshuffle-footer-btn[aria-pressed="true"] {
    opacity: 1;
    color: #f00;
    background: rgba(255,0,0,0.12);
  }

  #chapshuffle-reshuffle {
    min-width: 118px;
    white-space: nowrap;
  }
  .chapshuffle-primary {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.18);
    color: #fff;
    opacity: 1;
    font-weight: 600;
  }
  .chapshuffle-primary:hover:not(:disabled) { background: rgba(255,255,255,0.18); }
  #chapshuffle-loop {
    justify-self: start;
  }
  #chapshuffle-edit-exclusions {
    justify-self: end;
  }
  #chapshuffle-exclusion-done { flex: 1; }
  #chapshuffle-clear-exclusions { min-width: 96px; }

  .chapshuffle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--chapshuffle-row-height);
    padding: 8px 14px 8px 10px;
    cursor: grab;
    gap: 8px;
    border-left: 3px solid transparent;
    transition: background 0.1s, border-left-color 0.1s;
  }
  .chapshuffle-item:hover { background: rgba(255,255,255,0.08); }
  .chapshuffle-item:active { cursor: grabbing; }
  .chapshuffle-item.chapshuffle-active {
    border-left-color: #f00;
    background: rgba(255, 0, 0, 0.12);
    font-weight: 600;
  }
  .chapshuffle-drag-handle {
    width: 16px;
    flex: 0 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.38);
    cursor: grab;
    transform: translateX(-1px);
    transition: color 0.1s, opacity 0.1s;
    user-select: none;
  }
  .chapshuffle-drag-handle svg {
    display: block;
    pointer-events: none;
  }
  .chapshuffle-item:hover .chapshuffle-drag-handle,
  .chapshuffle-item.chapshuffle-active .chapshuffle-drag-handle {
    color: rgba(255,255,255,0.72);
  }
  .chapshuffle-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chapshuffle-time {
    opacity: 0.5;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }

  .chapshuffle-excluded {
    opacity: 0.5;
    cursor: default;
  }
  .chapshuffle-exclusion-row {
    cursor: pointer;
    padding-left: 14px;
  }
  .chapshuffle-exclusion-row:active {
    cursor: pointer;
  }
  .chapshuffle-exclusion-row.chapshuffle-excluded {
    opacity: 0.62;
    background: rgba(255,0,0,0.08);
  }
  .chapshuffle-exclusion-row.chapshuffle-excluded .chapshuffle-title {
    text-decoration: line-through;
    text-decoration-color: rgba(255,255,255,0.35);
  }
  .chapshuffle-exclusion-row.chapshuffle-exclusion-locked {
    cursor: default;
  }
  .chapshuffle-exclusion-row.chapshuffle-exclusion-locked .chapshuffle-exclusion-mark,
  .chapshuffle-exclusion-row.chapshuffle-exclusion-locked .chapshuffle-exclusion-state {
    opacity: 0.45;
  }
  .chapshuffle-exclusion-mark {
    width: 18px;
    flex: 0 0 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.5);
  }
  .chapshuffle-excluded .chapshuffle-exclusion-mark {
    color: #f00;
  }
  .chapshuffle-exclusion-state {
    flex: 0 0 54px;
    color: rgba(255,255,255,0.45);
    font-size: 11px;
    text-align: right;
  }
  .chapshuffle-excluded .chapshuffle-exclusion-state {
    color: rgba(255,110,110,0.85);
  }
  #chapshuffle-queue[data-mode="exclusions"] #chapshuffle-list {
    max-height: calc(var(--chapshuffle-row-height) * 10);
  }
  #chapshuffle-queue[data-mode="exclusions"] #chapshuffle-queue-footer {
    display: flex;
    justify-content: stretch;
    gap: 6px;
  }
  #chapshuffle-queue[data-mode="exclusions"] .chapshuffle-footer-btn {
    justify-content: center;
  }
  #chapshuffle-queue[data-mode="exclusions"] #chapshuffle-clear-exclusions {
    flex: 0 0 auto;
  }
  #chapshuffle-queue[data-mode="exclusions"] .chapshuffle-time {
    opacity: 0.45;
  }
`;
