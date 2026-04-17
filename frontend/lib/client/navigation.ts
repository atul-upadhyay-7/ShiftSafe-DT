type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

function isHistoryMutationError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase();
  return (
    (msg.includes("dispatchevent") && msg.includes("null")) ||
    (msg.includes("removechild") && msg.includes("not a child"))
  );
}

function fallbackNavigate(href: string, replace: boolean): void {
  if (typeof window === "undefined") return;

  if (replace) {
    window.location.replace(href);
    return;
  }

  window.location.assign(href);
}

export function safePush(router: RouterLike, href: string): void {
  try {
    router.push(href);
  } catch (error) {
    if (!isHistoryMutationError(error)) {
      console.warn("router.push failed; falling back to hard navigation", error);
    }
    fallbackNavigate(href, false);
  }
}

export function safeReplace(router: RouterLike, href: string): void {
  try {
    router.replace(href);
  } catch (error) {
    if (!isHistoryMutationError(error)) {
      console.warn("router.replace failed; falling back to hard navigation", error);
    }
    fallbackNavigate(href, true);
  }
}
