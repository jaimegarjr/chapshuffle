import { TutorialManager } from '../src/ui/Tutorial';

function setupDoc(): Document {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  return document;
}

function addTutorialTargets(doc: Document): void {
  // Add elements that tutorial steps anchor to
  const btn = doc.createElement('button');
  btn.id = 'chapshuffle-btn';
  doc.body.appendChild(btn);

  const queue = doc.createElement('div');
  queue.id = 'chapshuffle-queue';
  queue.style.display = 'none';
  doc.body.appendChild(queue);

  const header = doc.createElement('div');
  header.id = 'chapshuffle-queue-header';
  doc.body.appendChild(header);

  const nav = doc.createElement('div');
  nav.id = 'chapshuffle-nav';
  doc.body.appendChild(nav);

  const reshuffle = doc.createElement('button');
  reshuffle.id = 'chapshuffle-reshuffle';
  doc.body.appendChild(reshuffle);

  const loop = doc.createElement('button');
  loop.id = 'chapshuffle-loop';
  doc.body.appendChild(loop);

  const item = doc.createElement('div');
  item.className = 'chapshuffle-item';
  const handle = doc.createElement('span');
  handle.className = 'chapshuffle-drag-handle';
  item.appendChild(handle);
  doc.body.appendChild(item);
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('TutorialManager — lifecycle', () => {
  test('isActive is false before start()', () => {
    const doc = setupDoc();
    const tm = new TutorialManager(doc, () => {});
    expect(tm.isActive).toBe(false);
  });

  test('start() shows the overlay element #chapshuffle-tutorial', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    expect(doc.getElementById('chapshuffle-tutorial')).not.toBeNull();
    expect(tm.isActive).toBe(true);
  });

  test('currentStep is 0 after start()', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    expect(tm.currentStep).toBe(0);
  });

  test('next() advances currentStep', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    tm.next();
    expect(tm.currentStep).toBe(1);
  });

  test('next() on last step (6) calls onComplete and deactivates', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const onComplete = jest.fn();
    const tm = new TutorialManager(doc, onComplete);
    tm.start();
    // advance to step 6
    tm.next(); // 1
    tm.next(); // 2
    tm.next(); // 3
    tm.next(); // 4
    tm.next(); // 5
    tm.next(); // 6
    expect(tm.currentStep).toBe(6);
    tm.next(); // past last step => complete
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(tm.isActive).toBe(false);
    expect(doc.getElementById('chapshuffle-tutorial')).toBeNull();
  });

  test('skip() calls onComplete and removes overlay', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const onComplete = jest.fn();
    const tm = new TutorialManager(doc, onComplete);
    tm.start();
    tm.skip();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(tm.isActive).toBe(false);
    expect(doc.getElementById('chapshuffle-tutorial')).toBeNull();
  });

  test('destroy() removes overlay', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    expect(doc.getElementById('chapshuffle-tutorial')).not.toBeNull();
    tm.destroy();
    expect(doc.getElementById('chapshuffle-tutorial')).toBeNull();
    expect(tm.isActive).toBe(false);
  });
});

describe('TutorialManager — DOM button interactions', () => {
  test('clicking the Next button DOM element advances step', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    expect(tm.currentStep).toBe(0);
    const nextBtn = doc.getElementById('chapshuffle-tutorial-next') as HTMLButtonElement;
    expect(nextBtn).not.toBeNull();
    nextBtn.click();
    expect(tm.currentStep).toBe(1);
  });

  test('clicking the Skip button DOM element calls skip', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const onComplete = jest.fn();
    const tm = new TutorialManager(doc, onComplete);
    tm.start();
    const skipBtn = doc.getElementById('chapshuffle-tutorial-skip') as HTMLButtonElement;
    expect(skipBtn).not.toBeNull();
    skipBtn.click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(tm.isActive).toBe(false);
  });
});

describe('TutorialManager — panel opening', () => {
  test('advancing from step 0 to step 1 calls the openPanel callback', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const openPanel = jest.fn(() => {
      const panel = doc.getElementById('chapshuffle-queue');
      if (panel) panel.style.display = 'block';
    });
    const tm = new TutorialManager(doc, () => {}, openPanel);
    tm.start();
    const queue = doc.getElementById('chapshuffle-queue')!;
    expect(queue.style.display).toBe('none');
    tm.next();
    expect(openPanel).toHaveBeenCalledTimes(1);
    expect(queue.style.display).toBe('block');
  });

  test('openPanel callback is not called when panel is already open', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const queue = doc.getElementById('chapshuffle-queue')!;
    queue.style.display = 'block';
    const openPanel = jest.fn();
    const tm = new TutorialManager(doc, () => {}, openPanel);
    tm.start();
    tm.next();
    expect(openPanel).not.toHaveBeenCalled();
  });
});

describe('TutorialManager — anchor click auto-advance', () => {
  test('clicking #chapshuffle-btn on step 0 auto-advances to step 1', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    expect(tm.currentStep).toBe(0);
    (doc.getElementById('chapshuffle-btn') as HTMLButtonElement).click();
    expect(tm.currentStep).toBe(1);
    tm.destroy();
  });

  test('clicking Next → on step 0 removes anchor listener so button click no longer advances', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    (doc.getElementById('chapshuffle-tutorial-next') as HTMLButtonElement).click();
    expect(tm.currentStep).toBe(1);
    // Button click should not advance past step 1 now
    (doc.getElementById('chapshuffle-btn') as HTMLButtonElement).click();
    expect(tm.currentStep).toBe(1);
    tm.destroy();
  });
});

describe('TutorialManager — pointer arrows', () => {
  test('overlay contains an arrow element when target exists', () => {
    const doc = setupDoc();
    addTutorialTargets(doc);
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    const arrow = doc.querySelector('.chapshuffle-tutorial-arrow') as HTMLElement;
    expect(arrow).not.toBeNull();
    expect(arrow.dataset.dir).toBeDefined();
    tm.destroy();
  });

  test('arrow is hidden when target element is not in DOM', () => {
    const doc = setupDoc();
    // No tutorial targets added — step 0's #chapshuffle-btn won't resolve
    const tm = new TutorialManager(doc, () => {});
    tm.start();
    const arrow = doc.querySelector('.chapshuffle-tutorial-arrow') as HTMLElement;
    expect(arrow).not.toBeNull();
    expect(arrow.style.display).toBe('none');
    tm.destroy();
  });
});
