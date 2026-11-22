import { use, useMemo, useState } from "react";
import "./image-ready.css";

const imageTimeout = 30_000;
const preloads = new Map();

function watchImage(image, onState) {
  let stopped = false;
  // Native lazy loading can defer a request until the image is near the viewport.
  let timeout = image.loading === "lazy" ? null : setTimeout(fail, imageTimeout);

  function stop() {
    stopped = true;
    clearTimeout(timeout);
    image.removeEventListener("load", loaded);
    image.removeEventListener("error", fail);
  }

  function settle(state) {
    if (stopped) return;
    stop();
    onState(state);
  }

  function fail() {
    settle("error");
  }

  function loaded() {
    image.removeEventListener("load", loaded);
    if (!image.naturalWidth) {
      fail();
      return;
    }
    if (typeof image.decode !== "function") {
      settle("ready");
      return;
    }
    timeout ??= setTimeout(fail, imageTimeout);
    image.decode().then(() => settle("ready"), fail);
  }

  image.addEventListener("load", loaded);
  image.addEventListener("error", fail);
  if (image.complete) loaded();
  return stop;
}

function preloadImage(src) {
  const image = new Image();
  const entry = { state: "pending" };
  image.src = src;
  entry.promise = new Promise(resolve => {
    watchImage(image, state => {
      entry.state = state;
      resolve();
    });
  });
  preloads.set(src, entry);
  return entry.promise;
}

export function useRouteImages(sources) {
  const pending = [];
  for (const source of new Set(sources.filter(Boolean))) {
    const entry = preloads.get(source);
    if (!entry) pending.push(preloadImage(source));
    else if (entry.state === "pending") pending.push(entry.promise);
  }
  for (const promise of pending) use(promise);
}

export function useImagesReady(sources) {
  const [progress, setProgress] = useState(null);
  const sourceKey = JSON.stringify(sources);
  const group = useMemo(() => {
    const urls = JSON.parse(sourceKey);
    const nextGroup = { initialStates: urls.map(src => preloads.get(src)?.state), refs: [] };
    nextGroup.refs = urls.map((src, index) => src ? image => {
      if (!image) return;
      return watchImage(image, state => {
        const preload = preloads.get(src);
        if (preload && preload.state !== "pending") preload.state = state;
        setProgress(current => {
          const states = current?.group === nextGroup ? current.states : {};
          if ((states[index] ?? nextGroup.initialStates[index]) === state) return current;
          return { group: nextGroup, states: { ...states, [index]: state } };
        });
      });
    } : undefined);
    return nextGroup;
  }, [sourceKey]);

  const imageProps = sources.map((src, index) => {
    const state = progress?.group === group ? progress.states[index] : undefined;
    return {
      src: src || undefined,
      ref: group.refs[index],
      "data-image-state": src ? state ?? group.initialStates[index] ?? "pending" : undefined,
    };
  });
  return { pending: imageProps.some(props => props["data-image-state"] === "pending"), imageProps };
}

export function useImageReady(src, enabled = true) {
  const { pending, imageProps: [props] } = useImagesReady([enabled ? src : null]);
  return { pending, imageProps: { ...props, src: src || undefined } };
}
