const TUTORIAL_CSS_ID = 'chapshuffle-tutorial-styles';
const TUTORIAL_ID = 'chapshuffle-tutorial';
const POPUP_WIDTH = 260;
const ARROW_HALF = 6;

interface TutorialStep {
  targetSelector: string | null;
  message: string;
  openPanelBefore?: boolean;
  listenAnchorClick?: boolean;
}

const STEPS: TutorialStep[] = [
  {
    targetSelector: '#chapshuffle-btn',
    message: 'Click the shuffle button to open your chapter queue.',
    listenAnchorClick: true,
  },
  {
    targetSelector: '#chapshuffle-queue-header',
    message: 'This is your shuffle queue — chapters play in a randomized order.',
    openPanelBefore: true,
  },
  {
    targetSelector: '.chapshuffle-nav-btn',
    message: 'Use the arrows to jump to the previous or next chapter.',
    openPanelBefore: true,
  },
  {
    targetSelector: '#chapshuffle-reshuffle',
    message: 'Hit Reshuffle to get a brand new random chapter order.',
    openPanelBefore: true,
  },
  {
    targetSelector: '#chapshuffle-loop',
    message: 'Hit Loop to repeat the current chapter on a loop until you turn it off.',
    openPanelBefore: true,
  },
  {
    targetSelector: '.chapshuffle-drag-handle',
    message: 'Drag any chapter row to set your own custom play order.',
    openPanelBefore: true,
  },
  {
    targetSelector: '#chapshuffle-edit-exclusions',
    message: 'Open exclusion mode when you want to choose which chapters shuffle can play.',
    openPanelBefore: true,
  },
  {
    targetSelector: '#chapshuffle-queue-footer',
    message: 'In exclusion mode, rows toggle inclusion and Done returns you to the queue.',
    openPanelBefore: true,
  },
  {
    targetSelector: '#chapshuffle-btn',
    message: 'All set! Find more options — like auto-advance — in the extension menu.',
  },
];

const TUTORIAL_CSS = `
  #chapshuffle-tutorial {
    position: fixed;
    z-index: 2147483647;
    background: rgba(15,15,15,0.97);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 10px;
    padding: 14px 16px 12px;
    width: ${POPUP_WIDTH}px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.7);
    color: #fff;
    font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    box-sizing: border-box;
    overflow: visible;
  }
  #chapshuffle-tutorial * { box-sizing: border-box; }
  #chapshuffle-tutorial-message { margin-bottom: 12px; }
  #chapshuffle-tutorial-footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #chapshuffle-tutorial-skip {
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    font-size: 11px;
    cursor: pointer;
    padding: 4px 0;
    font-family: inherit;
  }
  #chapshuffle-tutorial-skip:hover { color: rgba(255,255,255,0.7); }
  #chapshuffle-tutorial-dots {
    flex: 1;
    text-align: center;
    font-size: 10px;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.25);
  }
  .chapshuffle-dot-active { color: #cc0000; }
  #chapshuffle-tutorial-next {
    background: #cc0000;
    border: none;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
    white-space: nowrap;
  }
  #chapshuffle-tutorial-next:hover { background: #e00000; }
  .chapshuffle-tutorial-arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    background: rgba(15,15,15,0.97);
    border: 1px solid rgba(255,255,255,0.2);
    pointer-events: none;
    z-index: 1;
  }
  .chapshuffle-tutorial-arrow[data-dir="down"] {
    bottom: -7px;
    transform: rotate(45deg);
    border-top: none;
    border-left: none;
  }
  .chapshuffle-tutorial-arrow[data-dir="up"] {
    top: -7px;
    transform: rotate(45deg);
    border-bottom: none;
    border-right: none;
  }
`;

export class TutorialManager {
  private readonly _doc: Document;
  private readonly _onComplete: () => void;
  private readonly _openPanel: (() => void) | null;
  private _step = 0;
  private _overlay: HTMLElement | null = null;
  private _anchorEl: Element | null = null;
  private _anchorClickHandler: (() => void) | null = null;

  constructor(doc: Document, onComplete: () => void, openPanel?: () => void) {
    this._doc = doc;
    this._onComplete = onComplete;
    this._openPanel = openPanel ?? null;
  }

  get isActive(): boolean {
    return this._overlay !== null;
  }

  get currentStep(): number {
    return this._step;
  }

  start(): void {
    this._injectCss();
    this._step = 0;
    this._showStep();
  }

  next(): void {
    if (!this.isActive) return;
    const nextStep = this._step + 1;
    if (nextStep >= STEPS.length) {
      this.skip();
      return;
    }
    // Detach the anchor listener before opening the panel — the open
    // call may trigger a click on the anchor element, which would cause
    // a re-entrant next() call if the listener were still attached.
    this._detachAnchorListener();
    if (STEPS[nextStep].openPanelBefore) {
      const panel = this._doc.getElementById('chapshuffle-queue');
      if (panel && panel.style.display !== 'flex') {
        if (this._openPanel) {
          this._openPanel();
        } else {
          panel.style.display = 'flex';
          this._doc.getElementById('chapshuffle-btn')?.setAttribute('aria-expanded', 'true');
        }
      }
    }
    this._step = nextStep;
    this._showStep();
  }

  skip(): void {
    this._removeOverlay();
    this._onComplete();
  }

  destroy(): void {
    this._removeOverlay();
  }

  private _injectCss(): void {
    if (this._doc.getElementById(TUTORIAL_CSS_ID)) return;
    const style = this._doc.createElement('style');
    style.id = TUTORIAL_CSS_ID;
    style.textContent = TUTORIAL_CSS;
    (this._doc.head ?? this._doc.documentElement).appendChild(style);
  }

  private _showStep(): void {
    this._removeOverlay();
    const step = STEPS[this._step];
    const isLast = this._step === STEPS.length - 1;

    const overlay = this._doc.createElement('div');
    overlay.id = TUTORIAL_ID;

    const arrow = this._doc.createElement('div');
    arrow.className = 'chapshuffle-tutorial-arrow';
    overlay.appendChild(arrow);

    const msg = this._doc.createElement('p');
    msg.id = 'chapshuffle-tutorial-message';
    msg.textContent = step.message;

    const footer = this._doc.createElement('div');
    footer.id = 'chapshuffle-tutorial-footer';

    const skip = this._doc.createElement('button');
    skip.id = 'chapshuffle-tutorial-skip';
    skip.textContent = isLast ? '' : 'Skip';
    skip.style.visibility = isLast ? 'hidden' : 'visible';
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });

    const dots = this._doc.createElement('span');
    dots.id = 'chapshuffle-tutorial-dots';
    dots.innerHTML = STEPS.map(
      (_, i) => `<span class="${i === this._step ? 'chapshuffle-dot-active' : ''}">●</span>`
    ).join('');

    const next = this._doc.createElement('button');
    next.id = 'chapshuffle-tutorial-next';
    next.textContent = isLast ? 'Done' : 'Next →';
    next.addEventListener('click', (e) => {
      e.stopPropagation();
      this.next();
    });

    footer.appendChild(skip);
    footer.appendChild(dots);
    footer.appendChild(next);
    overlay.appendChild(msg);
    overlay.appendChild(footer);
    this._doc.body.appendChild(overlay);
    this._overlay = overlay;

    const anchor = step.targetSelector ? this._doc.querySelector(step.targetSelector) : null;
    this._positionNearElement(overlay, arrow, anchor);

    if (step.listenAnchorClick && anchor) {
      this._anchorEl = anchor;
      this._anchorClickHandler = () => this.next();
      anchor.addEventListener('click', this._anchorClickHandler);
    }
  }

  private _positionNearElement(
    overlay: HTMLElement,
    arrow: HTMLElement,
    target: Element | null
  ): void {
    const win = this._doc.defaultView;
    if (!win) return;
    const vpW = win.innerWidth || this._doc.documentElement.clientWidth;
    const vpH = win.innerHeight || this._doc.documentElement.clientHeight;
    const POPUP_H = 110;
    const GAP = 20;
    const MARGIN = 8;

    if (!target) {
      overlay.style.top = `${Math.round(vpH / 2 - POPUP_H / 2)}px`;
      overlay.style.left = `${Math.round(vpW / 2 - POPUP_WIDTH / 2)}px`;
      arrow.style.display = 'none';
      return;
    }

    const rect = target.getBoundingClientRect();
    const anchorCenterX = rect.left + rect.width / 2;
    const popoverLeft = Math.max(
      MARGIN,
      Math.min(Math.round(anchorCenterX - POPUP_WIDTH / 2), vpW - POPUP_WIDTH - MARGIN)
    );

    let popoverTop: number;
    let arrowDir: 'up' | 'down';

    if (rect.top - POPUP_H - GAP >= MARGIN) {
      popoverTop = Math.round(rect.top - POPUP_H - GAP);
      arrowDir = 'down';
    } else {
      popoverTop = Math.round(rect.bottom + GAP);
      arrowDir = 'up';
    }
    popoverTop = Math.max(MARGIN, Math.min(popoverTop, vpH - POPUP_H - MARGIN));

    overlay.style.top = `${popoverTop}px`;
    overlay.style.left = `${popoverLeft}px`;

    arrow.dataset.dir = arrowDir;
    const arrowCenterInPopover = Math.round(anchorCenterX - popoverLeft);
    arrow.style.left = `${Math.max(ARROW_HALF + 4, Math.min(arrowCenterInPopover - ARROW_HALF, POPUP_WIDTH - ARROW_HALF * 2 - 4))}px`;
  }

  private _detachAnchorListener(): void {
    if (this._anchorEl && this._anchorClickHandler) {
      this._anchorEl.removeEventListener('click', this._anchorClickHandler);
      this._anchorEl = null;
      this._anchorClickHandler = null;
    }
  }

  private _removeOverlay(): void {
    this._detachAnchorListener();
    this._overlay?.remove();
    this._overlay = null;
  }
}
