<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({ label: String, value: String, options: Array });
const emit = defineEmits(["choose"]);
const open = ref(false);
const root = ref(null);
const trigger = ref(null);
const items = ref([]);

async function show() {
  open.value = true;
  await nextTick();
  items.value.find((item) => item.dataset.value === props.value)?.focus();
}
function close(restoreFocus = false) {
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}
function choose(option) {
  close(true);
  if (option !== props.value) emit("choose", option);
}
function navigate(event) {
  const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
  const index = buttons.indexOf(document.activeElement);
  const last = buttons.length - 1;
  const targets = {
    ArrowDown: (index + 1) % buttons.length,
    ArrowUp: (index + last) % buttons.length,
    Home: 0,
    End: last,
  };
  if (event.key === "Escape") {
    event.stopPropagation();
    event.preventDefault();
    close(true);
  } else if (Object.hasOwn(targets, event.key)) {
    event.preventDefault();
    buttons[targets[event.key]].focus();
  }
}
function outside(event) {
  if (open.value && !root.value?.contains(event.target)) close();
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>
<template>
  <div ref="root" class="booking-choice" @focusout="!$el.contains($event.relatedTarget) && close()">
    <button ref="trigger" class="booking-trigger" aria-haspopup="menu"
      :aria-expanded="open" :aria-label="label + ' — ' + value"
      @click="open ? close() : show()" @keydown.down.prevent="show" @keydown.up.prevent="show">
      {{ value }}
    </button>
    <div v-if="open" class="booking-options" role="menu" :aria-label="label" @keydown="navigate">
      <button v-for="option in options" :key="option" ref="items"
        :data-value="option" role="menuitemradio" :aria-checked="option === value"
        tabindex="-1" @click="choose(option)">
        {{ option }}<span v-if="option === value" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>
