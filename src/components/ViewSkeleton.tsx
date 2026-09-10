import type { TabId } from '@/state/store';

/**
 * What a tab shows while its chunk is in flight.
 *
 * Every tab is code-split, so the fallback has to hold the space the real panels
 * will take. A spinner in an empty page would collapse the document to the header
 * height and then push the footer back down a beat later, which reads as the
 * layout breaking rather than as content loading.
 *
 * These heights were measured off the running app at 1280 px with a full range
 * loaded, so they are close rather than guessed. They cannot be exact — a panel
 * grows with a longer subtitle, a narrower window or a taller table — and they do
 * not have to be: what matters is that the page does not visibly lurch. Panels
 * whose height depends on the data (the activity table, the daily table) are the
 * loose ones.
 */
const LAYOUTS: Record<TabId, { span: number; height: number }[]> = {
  overview: [
    { span: 12, height: 287 },
    { span: 12, height: 149 },
    { span: 12, height: 240 },
    { span: 7, height: 380 },
    { span: 12, height: 311 },
    { span: 5, height: 327 },
  ],
  recovery: [
    { span: 12, height: 376 },
    { span: 6, height: 383 },
    { span: 6, height: 383 },
    { span: 6, height: 432 },
    { span: 6, height: 432 },
    { span: 6, height: 413 },
    { span: 6, height: 413 },
  ],
  sleep: [
    { span: 12, height: 458 },
    { span: 12, height: 348 },
    { span: 12, height: 149 },
    { span: 7, height: 346 },
    { span: 5, height: 346 },
    { span: 6, height: 318 },
    { span: 6, height: 318 },
  ],
  training: [
    { span: 12, height: 452 },
    { span: 12, height: 439 },
    { span: 12, height: 291 },
    { span: 7, height: 261 },
    { span: 5, height: 261 },
    { span: 6, height: 291 },
    { span: 6, height: 291 },
  ],
  habits: [
    { span: 12, height: 27 },
    { span: 12, height: 482 },
    { span: 12, height: 361 },
    { span: 12, height: 401 },
  ],
  models: [
    { span: 12, height: 320 },
    { span: 12, height: 190 },
    { span: 12, height: 300 },
    { span: 12, height: 420 },
    { span: 12, height: 200 },
  ],
  data: [{ span: 12, height: 639 }],
};

export function ViewSkeleton({ tab }: { tab: TabId }) {
  return (
    <div className="grid" aria-hidden="true">
      {LAYOUTS[tab].map((box, i) => (
        <div key={i} className={`panel span-${box.span} skeleton`} style={{ height: box.height }} />
      ))}
    </div>
  );
}
