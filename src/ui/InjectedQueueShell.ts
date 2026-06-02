import { renderQueuePanel, unmountQueuePanel, type QueuePanelProps } from './QueuePanel';

const STYLES_ID = 'chapshuffle-styles';
const PANEL_ID = 'chapshuffle-queue';
const BTN_ID = 'chapshuffle-btn';
const VIDEO_SEL = 'video';
const PANEL_WIDTH_PX = 360;
const PANEL_MARGIN_PX = 24;
const PLAYER_CONTROLS_CLEARANCE_PX = 72;
const VIEWPORT_MARGIN_PX = 16;
const PANEL_FADE_MS = 160;
export const PANEL_OPEN_DISPLAY = 'flex';
const PLAYER_WAKE_INTERVAL_MS = 300;

const CSS = `
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

export class InjectedQueueShell {
  private readonly _doc: Document;
  private readonly _onOpen: () => void;
  private _panelMount: HTMLDivElement | null = null;
  private _panelElement: HTMLElement | null = null;
  private _playerElement: Element | null = null;
  private _controlsObserver: MutationObserver | null = null;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;
  private _playerWakeTimer: ReturnType<typeof setInterval> | null = null;
  private _panelWantedOpen = false;
  private _panelInteractionActive = false;
  private _hasRendered = false;

  constructor(doc: Document, onOpen: () => void) {
    this._doc = doc;
    this._onOpen = onOpen;
  }

  get isMounted(): boolean {
    return this._doc.getElementById(BTN_ID) !== null;
  }

  injectStyles(): void {
    if (this._doc.getElementById(STYLES_ID)) return;
    const style = this._doc.createElement('style');
    style.id = STYLES_ID;
    style.textContent = CSS;
    (this._doc.head ?? this._doc.documentElement).appendChild(style);
  }

  mount(controlsBar: Element): void {
    if (this.isMounted) return;
    this._panelMount = this._doc.createElement('div');
    this._doc.body.appendChild(this._panelMount);
    controlsBar.prepend(this._buildToggleButton());
    this._observePlayerControls(controlsBar);
  }

  render(props: QueuePanelProps): void {
    if (!this._panelMount) return;
    renderQueuePanel(this._panelMount, props);
    this._bindPanelInteractions();

    if (!this._hasRendered) {
      this._hasRendered = true;
      const panel = this._doc.getElementById(PANEL_ID);
      if (panel) panel.style.display = 'none';
    }
  }

  updateShuffleState(enabled: boolean): void {
    const btn = this._doc.getElementById(BTN_ID);
    if (!btn) return;
    if (enabled) {
      btn.removeAttribute('data-shuffle-off');
    } else {
      btn.setAttribute('data-shuffle-off', 'true');
    }
  }

  openPanel(): void {
    const panel = this._doc.getElementById(PANEL_ID);
    const btn = this._doc.getElementById(BTN_ID);
    if (!panel || panel.style.display === PANEL_OPEN_DISPLAY) return;
    this._clearHideTimer();
    panel.classList.remove('chapshuffle-fading-out');
    this._panelWantedOpen = true;
    this._positionPanelOverVideo(panel);
    this._onOpen();
    panel.style.display = PANEL_OPEN_DISPLAY;
    btn?.setAttribute('aria-expanded', 'true');
    if (btn) btn.title = 'chapshuffle: close queue';
  }

  unmount(): void {
    this._controlsObserver?.disconnect();
    this._controlsObserver = null;
    this._clearHideTimer();
    this._stopWakingPlayerControls();
    this._unbindPanelInteractions();
    this._playerElement = null;
    if (this._panelMount) {
      unmountQueuePanel(this._panelMount);
      this._panelMount.remove();
      this._panelMount = null;
    }
    this._hasRendered = false;
    this._panelWantedOpen = false;
    this._panelInteractionActive = false;
    this._doc.getElementById(BTN_ID)?.remove();
  }

  private _buildToggleButton(): HTMLButtonElement {
    const btn = this._doc.createElement('button');
    btn.id = BTN_ID;
    btn.innerHTML =
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="m18 14 4 4-4 4"/>` +
      `<path d="m18 2 4 4-4 4"/>` +
      `<path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/>` +
      `<path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/>` +
      `<path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>` +
      `</svg>`;
    const badge = this._doc.createElement('span');
    badge.className = 'chapshuffle-shuffle-badge';
    badge.textContent = 'OFF';
    btn.appendChild(badge);
    btn.title = 'chapshuffle: open queue';
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._togglePanel();
    });
    return btn;
  }

  private _togglePanel(): void {
    const panel = this._doc.getElementById(PANEL_ID);
    const btn = this._doc.getElementById(BTN_ID);
    if (!panel) return;

    const opening = panel.style.display === 'none';
    if (opening) {
      this._clearHideTimer();
      panel.classList.remove('chapshuffle-fading-out');
      this._panelWantedOpen = true;
      this._positionPanelOverVideo(panel);
      this._onOpen();
      panel.style.display = PANEL_OPEN_DISPLAY;
      btn?.setAttribute('aria-expanded', 'true');
      if (btn) btn.title = 'chapshuffle: close queue';
      return;
    }
    this._hidePanel(false);
  }

  private _observePlayerControls(controlsBar: Element): void {
    this._controlsObserver?.disconnect();
    const player = controlsBar.closest('.html5-video-player') ?? controlsBar.parentElement;
    if (!player) return;
    this._playerElement = player;

    this._controlsObserver = new MutationObserver(() => {
      if (player.classList.contains('ytp-autohide')) {
        this._hidePanel(true);
      } else if (this._panelWantedOpen) {
        this._showPanel();
      }
    });
    this._controlsObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
  }

  private _hidePanel(fade: boolean): void {
    const panel = this._doc.getElementById(PANEL_ID);
    const btn = this._doc.getElementById(BTN_ID);
    if (!panel || panel.style.display !== PANEL_OPEN_DISPLAY) return;

    if (fade && this._panelInteractionActive) {
      this._wakePlayerControls();
      this._clearHideTimer();
      panel.classList.remove('chapshuffle-fading-out');
      return;
    }

    this._clearHideTimer();
    if (!fade) {
      this._panelWantedOpen = false;
      this._panelInteractionActive = false;
      this._stopWakingPlayerControls();
    }
    btn?.setAttribute('aria-expanded', 'false');
    if (btn) btn.title = 'chapshuffle: open queue';

    if (!fade) {
      panel.classList.remove('chapshuffle-fading-out');
      panel.style.display = 'none';
      return;
    }

    panel.classList.add('chapshuffle-fading-out');
    this._hideTimer = setTimeout(() => {
      const currentPanel = this._doc.getElementById(PANEL_ID);
      if (!currentPanel) return;
      currentPanel.style.display = 'none';
      currentPanel.classList.remove('chapshuffle-fading-out');
      this._hideTimer = null;
    }, PANEL_FADE_MS);
  }

  private _showPanel(): void {
    const panel = this._doc.getElementById(PANEL_ID);
    const btn = this._doc.getElementById(BTN_ID);
    if (!panel) return;

    this._clearHideTimer();
    panel.classList.remove('chapshuffle-fading-out');
    this._positionPanelOverVideo(panel);
    this._onOpen();
    panel.style.display = PANEL_OPEN_DISPLAY;
    btn?.setAttribute('aria-expanded', 'true');
    if (btn) btn.title = 'chapshuffle: close queue';
  }

  private _clearHideTimer(): void {
    if (this._hideTimer === null) return;
    clearTimeout(this._hideTimer);
    this._hideTimer = null;
  }

  private _bindPanelInteractions(): void {
    const panel = this._doc.getElementById(PANEL_ID);
    if (!(panel instanceof HTMLElement) || panel === this._panelElement) return;

    this._unbindPanelInteractions();
    this._panelElement = panel;
    panel.addEventListener('mouseenter', this._handlePanelInteractionStart);
    panel.addEventListener('mouseleave', this._handlePanelInteractionEnd);
    panel.addEventListener('focusin', this._handlePanelInteractionStart);
    panel.addEventListener('focusout', this._handlePanelFocusOut);
  }

  private _unbindPanelInteractions(): void {
    if (!this._panelElement) return;
    this._panelElement.removeEventListener('mouseenter', this._handlePanelInteractionStart);
    this._panelElement.removeEventListener('mouseleave', this._handlePanelInteractionEnd);
    this._panelElement.removeEventListener('focusin', this._handlePanelInteractionStart);
    this._panelElement.removeEventListener('focusout', this._handlePanelFocusOut);
    this._panelElement = null;
  }

  private _handlePanelInteractionStart = (): void => {
    this._panelInteractionActive = true;
    this._startWakingPlayerControls();
    this._clearHideTimer();
    const panel = this._doc.getElementById(PANEL_ID);
    panel?.classList.remove('chapshuffle-fading-out');
  };

  private _handlePanelInteractionEnd = (): void => {
    this._panelInteractionActive = false;
    this._stopWakingPlayerControls();
  };

  private _handlePanelFocusOut = (event: FocusEvent): void => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && this._panelElement?.contains(nextTarget)) return;
    this._handlePanelInteractionEnd();
  };

  private _startWakingPlayerControls(): void {
    this._wakePlayerControls();
    if (this._playerWakeTimer !== null) return;
    this._playerWakeTimer = setInterval(() => this._wakePlayerControls(), PLAYER_WAKE_INTERVAL_MS);
  }

  private _stopWakingPlayerControls(): void {
    if (this._playerWakeTimer === null) return;
    clearInterval(this._playerWakeTimer);
    this._playerWakeTimer = null;
  }

  private _wakePlayerControls(): void {
    const player = this._playerElement;
    if (!player) return;

    player.classList.remove('ytp-autohide');
    player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  }

  private _positionPanelOverVideo(panel: HTMLElement): void {
    const win = this._doc.defaultView;
    const video = this._doc.querySelector<HTMLVideoElement>(VIDEO_SEL);
    if (!win || !video) return;

    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const viewportWidth = win.innerWidth || this._doc.documentElement.clientWidth;
    const viewportHeight = win.innerHeight || this._doc.documentElement.clientHeight;
    const maxPanelHeight = Math.min(
      390,
      Math.max(180, rect.height - PANEL_MARGIN_PX * 2),
      Math.max(180, viewportHeight - VIEWPORT_MARGIN_PX * 2)
    );

    const preferredLeft = rect.right - PANEL_WIDTH_PX - PANEL_MARGIN_PX;
    const minVideoLeft = rect.left + PANEL_MARGIN_PX;
    const maxViewportLeft = viewportWidth - PANEL_WIDTH_PX - VIEWPORT_MARGIN_PX;
    const left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(Math.max(preferredLeft, minVideoLeft), maxViewportLeft)
    );

    const bottomFromViewport = viewportHeight - rect.bottom + PLAYER_CONTROLS_CLEARANCE_PX;

    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.top = 'auto';
    panel.style.bottom = `${Math.round(Math.max(VIEWPORT_MARGIN_PX, bottomFromViewport))}px`;
    panel.style.maxHeight = `${Math.round(maxPanelHeight)}px`;
  }
}
