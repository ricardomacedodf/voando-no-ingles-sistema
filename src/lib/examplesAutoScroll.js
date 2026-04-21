const EXAMPLES_SCROLL_TOP_OFFSET_DESKTOP = 110;
const EXAMPLES_SCROLL_TOP_OFFSET_MOBILE = 88;
const EXAMPLES_SCROLL_BOTTOM_OFFSET = 24;
const EXAMPLES_SCROLL_SECOND_PASS_DELAY_MS = 220;
const EXAMPLES_SCROLL_THIRD_PASS_DELAY_MS = 420;

function getTopOffset() {
  if (typeof window === "undefined") return EXAMPLES_SCROLL_TOP_OFFSET_DESKTOP;
  return window.innerWidth <= 767
    ? EXAMPLES_SCROLL_TOP_OFFSET_MOBILE
    : EXAMPLES_SCROLL_TOP_OFFSET_DESKTOP;
}

function scrollElementToComfortView(element) {
  if (typeof window === "undefined" || !element) return;

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const topOffset = getTopOffset();

  const alreadyComfortable =
    rect.top >= topOffset && rect.bottom <= viewportHeight - EXAMPLES_SCROLL_BOTTOM_OFFSET;

  if (alreadyComfortable) return;

  const absoluteTop = window.scrollY + rect.top;
  const targetTop = Math.max(0, absoluteTop - topOffset);

  window.scrollTo({
    top: targetTop,
    behavior: "smooth",
  });
}

export function scheduleExamplesAutoScroll(getElement) {
  if (typeof window === "undefined" || typeof getElement !== "function") {
    return () => {};
  }

  let rafA = 0;
  let rafB = 0;
  let secondPassTimer = 0;
  let thirdPassTimer = 0;

  const run = () => {
    const element = getElement();
    if (!element) return;
    scrollElementToComfortView(element);
  };

  rafA = window.requestAnimationFrame(() => {
    rafB = window.requestAnimationFrame(run);
  });

  secondPassTimer = window.setTimeout(run, EXAMPLES_SCROLL_SECOND_PASS_DELAY_MS);
  thirdPassTimer = window.setTimeout(run, EXAMPLES_SCROLL_THIRD_PASS_DELAY_MS);

  return () => {
    if (rafA) window.cancelAnimationFrame(rafA);
    if (rafB) window.cancelAnimationFrame(rafB);
    if (secondPassTimer) window.clearTimeout(secondPassTimer);
    if (thirdPassTimer) window.clearTimeout(thirdPassTimer);
  };
}

