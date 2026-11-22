import { useLayoutEffect } from "react";

const groups = [".rail > nav", ".calendar-modes", ".study-tabs", ".term-picker", ".month-strip", ".atlas-levels", ".atlas-index-tabs", ".atlas-filters", ".export-formats"];
const activeSelector = ':scope > button:is([aria-pressed="true"],[aria-current="page"],[aria-selected="true"])';

export default function useSlidingSelectors() {
  useLayoutEffect(() => {
    const root = document.querySelector(".v-application");
    const tracked = new Map(), memory = new Map();
    let disposed = false;
    function update(element, resized = false) {
      const item = tracked.get(element);
      const active = element.querySelector(activeSelector);
      if (!item || !active || !element.getClientRects().length) {
        if (item) delete element.dataset.slidingSelector;
        return;
      }
      const bounds = element.getBoundingClientRect(), button = active.getBoundingClientRect();
      if (!bounds.width || !button.width) return;
      const selection = active.getAttribute("aria-label") || active.textContent.trim();
      const position = {
        x:button.left - bounds.left + element.scrollLeft - element.clientLeft,
        y:button.top - bounds.top + element.scrollTop - element.clientTop,
        width:button.width, height:button.height,
        radius:getComputedStyle(active).borderRadius,
      };
      if (resized && item.selection === selection && item.position &&
          ["x","y","width","height"].every(key => Math.abs(position[key] - item.position[key]) < .1)) return;
      const write = box => {
        element.style.setProperty("--selector-x",box.x + "px");
        element.style.setProperty("--selector-y",box.y + "px");
        element.style.setProperty("--selector-width",box.width + "px");
        element.style.setProperty("--selector-height",box.height + "px");
        element.style.setProperty("--selector-radius",box.radius);
      };
      if (!element.hasAttribute("data-sliding-selector")) {
        const previous = memory.get(item.key);
        element.dataset.slidingSelector = "true";
        element.dataset.slideAnimate = "false";
        if (previous && previous.selection !== selection) {
          const scale = bounds.width / previous.groupWidth;
          write({...previous.position,x:previous.position.x * scale,width:previous.position.width * scale});
          // Establish the old position before animating a remounted control.
          getComputedStyle(element,"::before").transform;
          element.dataset.slideAnimate = "true";
        }
        write(position);
        getComputedStyle(element,"::before").transform;
        element.dataset.slideAnimate = "true";
      } else {
        write(position);
      }
      item.selection = selection;
      item.position = position;
      memory.set(item.key,{position,selection,groupWidth:bounds.width});
    }
    function scan() {
      if (disposed) return;
      for (const [element,item] of tracked) {
        if (!element.isConnected) {item.resize.disconnect();tracked.delete(element);}
      }
      for (const selector of groups) {
        for (const element of root.querySelectorAll(selector)) {
          if (!tracked.has(element)) {
            const labels = [...element.querySelectorAll(":scope > button")].map(b=>b.getAttribute("aria-label") || b.textContent.trim()).join("|");
            const resize = new ResizeObserver(()=>update(element,true));
            tracked.set(element,{key:selector + ":" + labels,resize,selection:null});
            resize.observe(element);
            for (const child of element.children) resize.observe(child);
          }
          update(element);
        }
      }
    }
    const mutations = new MutationObserver(scan);
    mutations.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-pressed","aria-current","aria-selected"]});
    scan();
    document.fonts.ready.then(()=>{if(!disposed)for(const element of tracked.keys())update(element,true);});
    return () => {
      disposed = true; mutations.disconnect();
      for (const [element,item] of tracked) {
        item.resize.disconnect();
        delete element.dataset.slidingSelector;
        delete element.dataset.slideAnimate;
      }
    };
  }, []);
}
