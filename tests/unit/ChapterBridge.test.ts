import { ChapterBridge } from '../../src/youtube/ChapterBridge';
import type { Chapter } from '../../src/types';

const ORIGIN = window.location.origin;

function dispatchChapters(chapters: Chapter[] | null, overrides: Partial<MessageEventInit> = {}): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { source: 'chapshuffle', type: 'chapters', chapters },
      origin: ORIGIN,
      source: window,
      ...overrides,
    })
  );
}

const sample: Chapter[] = [
  { title: 'Title Theme', startSeconds: 0 },
  { title: 'Deku Tree', startSeconds: 212 },
];

describe('ChapterBridge', () => {
  test('caches chapters relayed from the page world', () => {
    const bridge = new ChapterBridge(window);
    bridge.start();
    expect(bridge.current()).toBeNull();

    dispatchChapters(sample);
    expect(bridge.current()).toEqual(sample);

    bridge.stop();
  });

  test('treats an empty chapter list as null', () => {
    const bridge = new ChapterBridge(window);
    bridge.start();

    dispatchChapters(sample);
    expect(bridge.current()).toEqual(sample);

    dispatchChapters([]);
    expect(bridge.current()).toBeNull();

    bridge.stop();
  });

  test('ignores messages from other sources and foreign origins', () => {
    const bridge = new ChapterBridge(window);
    bridge.start();

    // Wrong source tag.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'someone-else', type: 'chapters', chapters: sample },
        origin: ORIGIN,
        source: window,
      })
    );
    expect(bridge.current()).toBeNull();

    // Foreign origin.
    dispatchChapters(sample, { origin: 'https://evil.example' });
    expect(bridge.current()).toBeNull();

    bridge.stop();
  });

  test('request() posts a request message to the page world', () => {
    const post = jest.spyOn(window, 'postMessage');
    const bridge = new ChapterBridge(window);

    bridge.request();

    expect(post).toHaveBeenCalledWith({ source: 'chapshuffle', type: 'request' }, ORIGIN);
    post.mockRestore();
  });

  test('stops listening and clears cache after stop()', () => {
    const bridge = new ChapterBridge(window);
    bridge.start();
    dispatchChapters(sample);
    expect(bridge.current()).toEqual(sample);

    bridge.stop();
    expect(bridge.current()).toBeNull();

    // Messages after stop() are ignored.
    dispatchChapters(sample);
    expect(bridge.current()).toBeNull();
  });
});
