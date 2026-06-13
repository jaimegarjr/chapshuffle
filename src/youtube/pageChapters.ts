// Runs in the page's MAIN world so it can read `window.ytInitialData` — page
// globals are invisible to the isolated content script. YouTube no longer fills
// the chapters panel until it is opened, so this blob is the only reliable
// source of chapter titles and times. We relay it out via window.postMessage.

const SOURCE = 'chapshuffle';

interface RelayChapter {
  title: string;
  startSeconds: number;
}

// ytInitialData is deeply nested and untyped; walk it with a narrow helper.
type Unknown = Record<string, unknown> | undefined;
const get = (obj: Unknown, key: string): Unknown => obj?.[key] as Unknown;

function readChapters(): RelayChapter[] | null {
  const data = (window as unknown as { ytInitialData?: Unknown }).ytInitialData;
  if (!data) return null;

  // Guard against stale data after SPA navigation: only trust chapters that
  // belong to the video currently in the address bar.
  const dataVideoId = get(get(data, 'currentVideoEndpoint'), 'watchEndpoint')?.['videoId'];
  const currentVideoId = new URLSearchParams(window.location.search).get('v');
  if (
    typeof dataVideoId === 'string' &&
    currentVideoId !== null &&
    dataVideoId !== currentVideoId
  ) {
    return null;
  }

  const markersMap = get(
    get(
      get(get(get(data, 'playerOverlays'), 'playerOverlayRenderer'), 'decoratedPlayerBarRenderer'),
      'decoratedPlayerBarRenderer'
    ),
    'playerBar'
  );
  const map = get(get(markersMap, 'multiMarkersPlayerBarRenderer'), 'markersMap');
  if (!Array.isArray(map)) return null;

  const entry = map.find((m) =>
    Array.isArray((m as { value?: { chapters?: unknown } })?.value?.chapters)
  );
  const chapters = (entry as { value?: { chapters?: unknown[] } } | undefined)?.value?.chapters;
  if (!Array.isArray(chapters) || chapters.length === 0) return null;

  const parsed: RelayChapter[] = [];
  for (const raw of chapters) {
    const renderer = get(raw as Unknown, 'chapterRenderer');
    const title = String(get(renderer, 'title')?.['simpleText'] ?? '').trim();
    const startMs = Number(renderer?.['timeRangeStartMillis'] ?? NaN);
    if (!title || Number.isNaN(startMs)) continue;
    parsed.push({ title, startSeconds: Math.max(0, Math.round(startMs / 1000)) });
  }
  return parsed.length > 0 ? parsed : null;
}

function postChapters(): void {
  window.postMessage(
    { source: SOURCE, type: 'chapters', chapters: readChapters() },
    window.location.origin
  );
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as { source?: string; type?: string } | null;
  if (data?.source === SOURCE && data.type === 'request') {
    postChapters();
  }
});

// YouTube reassigns ytInitialData on SPA navigation; refresh proactively too.
document.addEventListener('yt-navigate-finish', postChapters);
postChapters();
