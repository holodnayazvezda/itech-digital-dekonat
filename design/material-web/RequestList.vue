<script setup>
import { statuses } from "./campus-data.js";
defineProps({ records: Array });
const emit = defineEmits(["select"]);
</script>
<template>
  <p v-if="!records.length">Здесь появятся ваши заявки и решения деканата.</p>
  <button
    v-for="r in records"
    :key="r.id"
    class="case-row"
    @click="emit('select', r)"
  >
    <span
      ><b>{{ r.name }}</b
      ><small>{{
        r.kind === "booking" ? r.date + " · " + r.time + "–" + r.end : r.format
      }}</small></span
    ><i :class="'badge ' + r.status">{{ statuses[r.status] }}</i>
  </button>
</template>
