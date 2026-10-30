// Register game art without downloading it over the title screen's background.
type GameImage = { image: HTMLImageElement; source: string; loading?: Promise<void> };
const images: GameImage[] = [];
let started = false;

function load(entry: GameImage): Promise<void> {
  if (entry.loading) return entry.loading;
  if (entry.image.naturalWidth) return Promise.resolve();
  entry.loading = new Promise<void>((resolve, reject) => {
    const clean = () => { entry.image.removeEventListener("load", ready); entry.image.removeEventListener("error", failed); };
    const ready = () => { clean(); void entry.image.decode().catch(() => undefined).then(resolve); };
    const failed = () => { clean(); reject(new Error(`Could not load ${entry.source}`)); };
    entry.image.addEventListener("load", ready);
    entry.image.addEventListener("error", failed);
    entry.image.src = entry.source;
  }).catch(error => { entry.loading = undefined; throw error; });
  return entry.loading;
}

export function gameImage(source: string): HTMLImageElement {
  const image = new Image(); image.decoding = "async";
  const entry = { image, source }; images.push(entry);
  if (started) void load(entry).catch(() => undefined);
  return image;
}

export async function loadGameAssets() {
  started = true;
  await Promise.all(images.map(load));
}
