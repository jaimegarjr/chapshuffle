import { renderQueuePanel, unmountQueuePanel, type QueuePanelProps } from './QueuePanel';
import { CHAPSHUFFLE_CSS, PANEL_WIDTH_PX, PANEL_FADE_MS } from './InjectedQueueShell.css';

const STYLES_ID = 'chapshuffle-styles';
const PANEL_ID = 'chapshuffle-queue';
const BTN_ID = 'chapshuffle-btn';
const VIDEO_SEL = 'video';
const PANEL_MARGIN_PX = 24;
const PLAYER_CONTROLS_CLEARANCE_PX = 72;
const VIEWPORT_MARGIN_PX = 16;
export const PANEL_OPEN_DISPLAY = 'flex';
const PLAYER_WAKE_INTERVAL_MS = 300;

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
    style.textContent = CHAPSHUFFLE_CSS;
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
