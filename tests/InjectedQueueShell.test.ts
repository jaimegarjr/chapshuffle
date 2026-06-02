import { InjectedQueueShell } from '../src/ui/InjectedQueueShell';
import type { QueuePanelProps } from '../src/ui/QueuePanel';

const chapters = [
  { title: 'Intro', startSeconds: 0 },
  { title: 'Act 1', startSeconds: 60 },
];

function props(overrides: Partial<QueuePanelProps> = {}): QueuePanelProps {
  return {
    chapters,
    currentIndex: 0,
    progress: 0,
    loopMode: false,
    onSeek: () => {},
    onReshuffle: () => {},
    onLoopToggle: () => {},
    onPrev: () => {},
    onNext: () => {},
    onReorder: () => {},
    ...overrides,
  };
}

function addPlayerControls(doc: Document): Element {
  const el = doc.createElement('div');
  el.className = 'ytp-right-controls';
  doc.body.appendChild(el);
  return el;
}

function addPlayerWithControls(doc: Document): { player: Element; controls: Element } {
  const player = doc.createElement('div');
  player.className = 'html5-video-player';
  const controls = doc.createElement('div');
  controls.className = 'ytp-right-controls';
  player.appendChild(controls);
  doc.body.appendChild(player);
  return { player, controls };
}

function addVideoElement(doc: Document): HTMLVideoElement {
  const video = doc.createElement('video');
  doc.body.appendChild(video);
  return video;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('InjectedQueueShell', () => {
  test('injects styles only once', () => {
    const shell = new InjectedQueueShell(document, () => {});

    shell.injectStyles();
    shell.injectStyles();

    expect(document.querySelectorAll('#chapshuffle-styles')).toHaveLength(1);
  });

  test('mounts the toggle button and renders a hidden panel on first render', () => {
    const controls = addPlayerControls(document);
    const shell = new InjectedQueueShell(document, () => {});

    shell.mount(controls);
    shell.render(props());

    expect(document.getElementById('chapshuffle-btn')).not.toBeNull();
    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('none');
    expect(document.querySelectorAll('.chapshuffle-item')).toHaveLength(2);
  });

  test('opens and closes the panel from the toggle button', () => {
    const controls = addPlayerControls(document);
    addVideoElement(document);
    const onOpen = jest.fn();
    const shell = new InjectedQueueShell(document, onOpen);
    shell.mount(controls);
    shell.render(props());

    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();

    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('block');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(onOpen).toHaveBeenCalledTimes(1);

    btn.click();

    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('none');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('fades out the panel when YouTube auto-hides player controls', async () => {
    jest.useFakeTimers();
    const { player, controls } = addPlayerWithControls(document);
    addVideoElement(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();
    player.classList.add('ytp-autohide');
    await Promise.resolve();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    expect(panel.classList.contains('chapshuffle-fading-out')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    jest.runOnlyPendingTimers();

    expect(panel.style.display).toBe('none');
    expect(panel.classList.contains('chapshuffle-fading-out')).toBe(false);
    jest.useRealTimers();
  });

  test('keeps the panel and YouTube controls visible while the user is interacting with it', async () => {
    jest.useFakeTimers();
    const { player, controls } = addPlayerWithControls(document);
    addVideoElement(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    panel.dispatchEvent(new Event('mouseenter'));
    player.classList.add('ytp-autohide');
    await Promise.resolve();
    jest.runOnlyPendingTimers();

    expect(player.classList.contains('ytp-autohide')).toBe(false);
    expect(panel.style.display).toBe('block');
    expect(panel.classList.contains('chapshuffle-fading-out')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    jest.useRealTimers();
  });

  test('allows YouTube auto-hide to hide the panel after the user leaves the panel', async () => {
    jest.useFakeTimers();
    const { player, controls } = addPlayerWithControls(document);
    addVideoElement(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    panel.dispatchEvent(new Event('mouseenter'));
    player.classList.add('ytp-autohide');
    await Promise.resolve();
    expect(player.classList.contains('ytp-autohide')).toBe(false);

    panel.dispatchEvent(new Event('mouseleave'));
    player.classList.add('ytp-autohide');
    await Promise.resolve();

    expect(panel.classList.contains('chapshuffle-fading-out')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    jest.runOnlyPendingTimers();

    expect(panel.style.display).toBe('none');
    jest.useRealTimers();
  });

  test('leaves the panel open when YouTube controls are visible after the user leaves', async () => {
    jest.useFakeTimers();
    const { player, controls } = addPlayerWithControls(document);
    addVideoElement(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    panel.dispatchEvent(new Event('mouseenter'));
    player.classList.add('ytp-autohide');
    await Promise.resolve();

    panel.dispatchEvent(new Event('mouseleave'));
    jest.runOnlyPendingTimers();

    expect(player.classList.contains('ytp-autohide')).toBe(false);
    expect(panel.style.display).toBe('block');
    expect(panel.classList.contains('chapshuffle-fading-out')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    jest.useRealTimers();
  });

  test('restores an auto-hidden panel when YouTube shows player controls again', async () => {
    jest.useFakeTimers();
    const { player, controls } = addPlayerWithControls(document);
    addVideoElement(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();
    player.classList.add('ytp-autohide');
    await Promise.resolve();
    jest.runOnlyPendingTimers();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    expect(panel.style.display).toBe('none');

    player.classList.remove('ytp-autohide');
    await Promise.resolve();

    expect(panel.style.display).toBe('block');
    expect(panel.classList.contains('chapshuffle-fading-out')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    jest.useRealTimers();
  });

  test('does not restore the panel after the user closes it manually', async () => {
    jest.useFakeTimers();
    const { player, controls } = addPlayerWithControls(document);
    addVideoElement(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    const btn = document.getElementById('chapshuffle-btn') as HTMLButtonElement;
    btn.click();
    btn.click();

    player.classList.add('ytp-autohide');
    await Promise.resolve();
    player.classList.remove('ytp-autohide');
    await Promise.resolve();

    expect(document.getElementById('chapshuffle-queue')!.style.display).toBe('none');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    jest.useRealTimers();
  });

  test('positions the panel over the video when opened', () => {
    const controls = addPlayerControls(document);
    const video = addVideoElement(document);
    video.getBoundingClientRect = jest.fn(
      () =>
        ({
          x: 100,
          y: 50,
          top: 50,
          right: 900,
          bottom: 550,
          left: 100,
          width: 800,
          height: 500,
          toJSON: () => ({}),
        }) as DOMRect
    );
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    (document.getElementById('chapshuffle-btn') as HTMLButtonElement).click();

    const panel = document.getElementById('chapshuffle-queue') as HTMLDivElement;
    expect(panel.style.top).toBe('auto');
    expect(panel.style.left).toBe('516px');
    expect(panel.style.bottom).toBe('290px');
    expect(panel.style.right).toBe('auto');
  });

  test('openPanel() positions and shows the panel, calling onOpen', () => {
    const controls = addPlayerControls(document);
    const video = addVideoElement(document);
    video.getBoundingClientRect = jest.fn(
      () =>
        ({
          x: 100,
          y: 50,
          top: 50,
          right: 900,
          bottom: 550,
          left: 100,
          width: 800,
          height: 500,
          toJSON: () => ({}),
        }) as DOMRect
    );
    const onOpen = jest.fn();
    const shell = new InjectedQueueShell(document, onOpen);
    shell.mount(controls);
    shell.render(props());

    shell.openPanel();

    const panel = document.getElementById('chapshuffle-queue') as HTMLElement;
    expect(panel.style.display).toBe('block');
    expect(document.getElementById('chapshuffle-btn')!.getAttribute('aria-expanded')).toBe('true');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('openPanel() is a no-op when the panel is already open', () => {
    const controls = addPlayerControls(document);
    addVideoElement(document);
    const onOpen = jest.fn();
    const shell = new InjectedQueueShell(document, onOpen);
    shell.mount(controls);
    shell.render(props());
    shell.openPanel(); // first call opens it
    shell.openPanel(); // second call should be a no-op
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('unmount removes injected controls and panel', () => {
    const controls = addPlayerControls(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);
    shell.render(props());

    shell.unmount();

    expect(document.getElementById('chapshuffle-btn')).toBeNull();
    expect(document.getElementById('chapshuffle-queue')).toBeNull();
  });

  test('updateShuffleState(false) adds data-shuffle-off="true" attribute to button', () => {
    const controls = addPlayerControls(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);

    shell.updateShuffleState(false);

    const btn = document.getElementById('chapshuffle-btn');
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('data-shuffle-off')).toBe('true');
  });

  test('updateShuffleState(true) removes data-shuffle-off attribute', () => {
    const controls = addPlayerControls(document);
    const shell = new InjectedQueueShell(document, () => {});
    shell.mount(controls);

    shell.updateShuffleState(false);
    shell.updateShuffleState(true);

    const btn = document.getElementById('chapshuffle-btn');
    expect(btn).not.toBeNull();
    expect(btn!.hasAttribute('data-shuffle-off')).toBe(false);
  });
});
