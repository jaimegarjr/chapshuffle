import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve(__dirname, '../../dist');

export const PRIMARY_VIDEO_ID = 'mock-primary';
export const SECONDARY_VIDEO_ID = 'mock-secondary';
export const NO_CHAPTER_VIDEO_ID = 'mock-no-chapters';

interface StoredSettings {
  shuffleEnabled?: boolean;
  minChapters?: number;
  queueEndBehavior?: 'reshuffle' | 'end-video';
  tutorialComplete?: boolean;
}

interface MockChapter {
  title: string;
  startSeconds: number;
}

const VIDEOS: Record<string, MockChapter[]> = {
  [PRIMARY_VIDEO_ID]: [
    { title: 'Opening', startSeconds: 0 },
    { title: 'First movement', startSeconds: 3 },
    { title: 'Second movement', startSeconds: 7 },
    { title: 'Bridge', startSeconds: 12 },
    { title: 'Finale', startSeconds: 18 },
    { title: 'Credits', startSeconds: 22 },
  ],
  [SECONDARY_VIDEO_ID]: [
    { title: 'Setup', startSeconds: 0 },
    { title: 'API design', startSeconds: 4 },
    { title: 'Implementation', startSeconds: 8 },
    { title: 'Testing', startSeconds: 13 },
    { title: 'Deployment', startSeconds: 19 },
  ],
  [NO_CHAPTER_VIDEO_ID]: [],
};

function silentWavDataUrl(durationSeconds = 26): string {
  const sampleRate = 8_000;
  const dataSize = sampleRate * durationSeconds;
  const wav = Buffer.alloc(44 + dataSize, 128);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  return `data:audio/wav;base64,${wav.toString('base64')}`;
}

const mockMediaUrl = silentWavDataUrl();

function mockYouTubeHtml(videoId: string): string {
  const videosJson = JSON.stringify(VIDEOS).replace(/</g, '\\u003c');
  const initialVideoId = JSON.stringify(videoId);
  const mediaUrl = JSON.stringify(mockMediaUrl);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Mock YouTube</title>
    <style>
      body { margin: 0; background: #0f0f0f; color: white; font-family: Arial, sans-serif; }
      #movie_player { position: relative; width: 960px; height: 540px; background: #181818; }
      video { display: block; width: 100%; height: 100%; }
      .ytp-right-controls { position: absolute; right: 16px; bottom: 8px; display: flex; min-height: 40px; }
      ytd-macro-markers-list-renderer { display: block; padding: 16px; }
      ytd-macro-markers-list-item-renderer { display: block; }
    </style>
  </head>
  <body>
    <div id="movie_player" class="html5-video-player">
      <video src=${mediaUrl}></video>
      <div class="ytp-right-controls"></div>
    </div>
    <div id="chapters"></div>
    <script>
      (() => {
        const videos = ${videosJson};
        const video = document.querySelector('video');

        const renderChapters = (videoId) => {
          const chapters = videos[videoId] || [];
          document.querySelector('#chapters').innerHTML = chapters.length
            ? '<ytd-macro-markers-list-renderer>' +
                chapters.map((chapter) =>
                  '<ytd-macro-markers-list-item-renderer>' +
                    '<span id="time">' + chapter.timestamp + '</span>' +
                    '<h4 class="yt-simple-endpoint">' + chapter.title + '</h4>' +
                  '</ytd-macro-markers-list-item-renderer>'
                ).join('') +
              '</ytd-macro-markers-list-renderer>'
            : '';
        };

        for (const chapters of Object.values(videos)) {
          for (const chapter of chapters) {
            const minutes = Math.floor(chapter.startSeconds / 60);
            const seconds = String(chapter.startSeconds % 60).padStart(2, '0');
            chapter.timestamp = minutes + ':' + seconds;
          }
        }

        window.mockYouTube = {
          navigate(videoId) {
            history.pushState({}, '', '/watch?v=' + encodeURIComponent(videoId));
            video.currentTime = 0;
            renderChapters(videoId);
            document.dispatchEvent(new Event('yt-navigate-finish'));
          }
        };

        renderChapters(${initialVideoId});
      })();
    </script>
  </body>
</html>`;
}

export async function resetExtensionStorage(
  page: Page,
  extensionId: string,
  settings: StoredSettings = {}
): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(
    (nextSettings) =>
      new Promise<void>((resolve) => {
        chrome.storage.sync.clear(() => {
          chrome.storage.local.clear(() => {
            chrome.storage.sync.set(nextSettings, resolve);
          });
        });
      }),
    settings
  );
  await page.reload();
}

export async function openMockVideo(page: Page, videoId: string = PRIMARY_VIDEO_ID): Promise<void> {
  await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  await expect(page.locator('#chapshuffle-btn')).toBeVisible({ timeout: 10_000 });
}

export async function navigateToMockVideo(page: Page, videoId: string): Promise<void> {
  await page.evaluate((nextVideoId) => {
    (
      window as typeof window & {
        mockYouTube: { navigate: (videoId: string) => void };
      }
    ).mockYouTube.navigate(nextVideoId);
  }, videoId);
}

export async function openQueue(page: Page): Promise<void> {
  await page.locator('#chapshuffle-btn').click();
  await expect(page.locator('#chapshuffle-queue')).toBeVisible();
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await context.route('https://www.youtube.com/**', async (route) => {
      const videoId = new URL(route.request().url()).searchParams.get('v') ?? PRIMARY_VIDEO_ID;
      await route.fulfill({
        contentType: 'text/html',
        body: mockYouTubeHtml(videoId),
      });
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
