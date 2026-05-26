'use strict';

const { shuffle } = require('../shuffle/ShuffleEngine');

class PlaybackController {
  /**
   * @param {HTMLVideoElement} videoEl
   * @param {{ title: string, startSeconds: number }[]} chapters - original chapter list
   * @param {function} [shuffleFn] - override for testing; defaults to ShuffleEngine.shuffle
   */
  constructor(videoEl, chapters, shuffleFn) {
    this._shuffleFn = shuffleFn || shuffle;
    this._video = videoEl;
    // Keep a sorted copy to compute per-chapter end boundaries.
    this._sorted = [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);
    this._queue = this._shuffleFn([...this._sorted]);
    this._currentIndex = 0;
    this._bound = this._onTimeUpdate.bind(this);
    videoEl.addEventListener('timeupdate', this._bound);
  }

  get currentIndex() {
    return this._currentIndex;
  }

  get queue() {
    return [...this._queue];
  }

  // A chapter ends when currentTime reaches the start of the next chapter
  // in original (sorted) order, ensuring boundaries are video-accurate.
  _endSecondsFor(chapter) {
    const i = this._sorted.findIndex((c) => c.startSeconds === chapter.startSeconds);
    return i >= 0 && i < this._sorted.length - 1
      ? this._sorted[i + 1].startSeconds
      : Infinity;
  }

  _onTimeUpdate() {
    const chapter = this._queue[this._currentIndex];
    if (this._video.currentTime >= this._endSecondsFor(chapter)) {
      this._currentIndex = (this._currentIndex + 1) % this._queue.length;
      this._video.currentTime = this._queue[this._currentIndex].startSeconds;
    }
  }

  /**
   * Seeks to a specific chapter in the shuffled queue by index.
   * No-ops for out-of-range indices.
   */
  seekToChapter(index) {
    if (index < 0 || index >= this._queue.length) return;
    this._currentIndex = index;
    this._video.currentTime = this._queue[index].startSeconds;
  }

  /**
   * Generates a fresh shuffle order and restarts playback from queue index 0.
   */
  reshuffle() {
    this._queue = this._shuffleFn([...this._sorted]);
    this._currentIndex = 0;
    this._video.currentTime = this._queue[0].startSeconds;
  }

  /**
   * Removes the timeupdate listener. Call when the video is unloaded.
   */
  destroy() {
    this._video.removeEventListener('timeupdate', this._bound);
  }
}

module.exports = { PlaybackController };
