# Analytics release checklist

Complete this checklist before publishing a telemetry-enabled build.

## GA4 production setup

- [ ] Create a dedicated Chap Shuffle production GA4 property or web stream. Do not reuse the
      development property or Chrome Web Store listing analytics.
- [ ] Disable Google Signals and all advertising personalization/features.
- [ ] Select GA4's shortest useful event-data retention setting.
- [ ] Create a Measurement Protocol API secret for the production stream.
- [ ] Add `GA_MEASUREMENT_ID` and `GA_API_SECRET` as secrets on the protected GitHub
      `production` environment. Do not add them to repository secrets, local dotenv files, or CI.
- [ ] Require a reviewer for the GitHub `production` environment.

## Validation

- [ ] Build against the development property with
      `GA_MEASUREMENT_ID=... GA_API_SECRET=... just build-analytics`.
- [ ] Opt in through the extension popup and exercise every event in `src/analytics/EventPolicy.ts`.
- [ ] Validate a captured payload for every event name through the
      `https://www.google-analytics.com/debug/mp/collect` endpoint and confirm GA4 reports no
      validation messages.
- [ ] Confirm payloads contain no video ID, title, URL, channel, chapter name, search, or account
      data.
- [ ] Dispatch the release workflow and verify the production property receives events in Realtime.

## Initial GA4 reporting

- [ ] Create an Exploration or custom report for weekly active installations and returning
      installations.
- [ ] Report shuffled videos and active playback minutes per session.
- [ ] Report adoption of reshuffle, exclusions, loop, queue reorder, chapter skip, and chapter
      completion.
- [ ] Report session-ending reasons.
- [ ] Report analytics callout interactions as the proxy for feedback interest.

## Chrome Web Store disclosure

- [ ] Declare optional collection of pseudonymous identifiers and product interaction/usage data.
- [ ] State that analytics are used for product analytics, are not sold, and are not used for
      advertising, credit, or personalized recommendations.
- [ ] Link to `https://jaimegarjr.github.io/chapshuffle/#privacy`.
- [ ] Confirm the published privacy policy and Web Store disclosure match before submitting the
      release for review.
