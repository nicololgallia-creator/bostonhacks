// The phone's own Back button steps back inside the flow instead of leaving the page.
// Every screen that has a Back pushes one history entry with the function that undoes it.
// The Back buttons in the page call back(), so all Backs run through the browser's history.
const stack = [];
let skip = 0; // popstate events caused by release(), which must not run a handler

export const depth = () => stack.length;
export const back = () => history.back();

export function push(undo) {
  stack.push(undo);
  history.pushState(null, "");
}

// A screen closed by itself: drop its entries without running them.
export function release(to) {
  const n = stack.length - to;
  if (n <= 0) return;
  stack.length = to;
  skip += 1;
  history.go(-n);
}

addEventListener("popstate", () => {
  if (skip) { skip -= 1; return; }
  stack.pop()?.();
});
