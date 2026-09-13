const TUTORIAL_KEY = "drilly-p.tutorial-completed";

export function loadTutorialCompleted(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveTutorialCompleted() {
  try {
    localStorage.setItem(TUTORIAL_KEY, "true");
  } catch {
    // Storage may be unavailable; completion still holds for this session.
  }
}
