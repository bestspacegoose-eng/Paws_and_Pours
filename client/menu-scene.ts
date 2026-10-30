import introUrl from "./assets/menus/intro-tavern.webp";
import selectionUrl from "./assets/menus/bartender-tavern.webp";

const scenes = { intro: introUrl, selection: selectionUrl };
const ready = new Map<string, Promise<HTMLImageElement>>();

export async function loadMenuScene(element: HTMLElement, scene: keyof typeof scenes) {
  const source = scenes[scene];
  let loading = ready.get(source);
  if (!loading) {
    const image = new Image(); image.decoding = "async";
    image.fetchPriority = scene === "intro" ? "high" : "auto";
    image.src = source;
    loading = image.decode().then(() => image);
    ready.set(source, loading);
  }
  try {
    const image = await loading;
    // Apply only fully decoded art: no partially painted PNG rows on slow links.
    element.style.backgroundImage = `${scene === "selection" ? "linear-gradient(#26152f55,#26152f88)," : ""}url("${image.src}")`;
    element.dataset.sceneReady = "true";
  } catch {
    ready.delete(source); // A later visit can retry without disabling the menu.
    element.dataset.sceneReady = "false";
  }
}
