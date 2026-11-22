<script setup>
import { today, printDate } from "./timetable.js";
import { mdiArrowTopRight } from "@mdi/js";
defineProps({
  nextLesson: Object,
  lessonInProgress: Boolean,
  countdown: String,
  preview: Boolean,
  faculty: Boolean,
});
const emit = defineEmits(["lesson", "room", "teacher"]);
</script>
<template>
  <article class="next-class">
    <div class="lesson-head">
      <component
        :is="preview ? 'div' : 'button'"
        class="next-lesson"
        @click="emit('lesson')"
      >
        <span class="lesson-label">{{
          lessonInProgress ? "Сейчас идёт пара" : "Следующая пара"
        }}</span>
        <strong>{{ nextLesson.name }}</strong>
        <span class="countdown">{{ countdown }}</span>
        <span class="lesson-time"
          ><template v-if="faculty && nextLesson.date !== today"
            >{{
              printDate(nextLesson.date, { day: "numeric", month: "short" })
            }}
            · </template
          >{{ nextLesson.time }} — {{ nextLesson.end }} <span> / </span>
          {{ nextLesson.type }}</span
        >
      </component>
      <span v-if="faculty" class="instructor group-hero"
        >Группа <b>{{ nextLesson.group }}</b></span
      ><component
        v-else
        :is="preview ? 'div' : 'button'"
        class="instructor"
        @click="emit('teacher')"
        >{{ nextLesson.teacher }}
        <v-icon v-if="!preview" :icon="mdiArrowTopRight"
      /></component>
    </div>
    <component
      :is="preview ? 'div' : 'button'"
      class="campus-plate"
      :aria-label="'Открыть расписание аудитории ' + nextLesson.room"
      @click="emit('room')"
    >
      <img
        :src="'./' + nextLesson.building.image"
        :alt="nextLesson.building.alt"
      />
      <span class="plate-caption"
        ><b>{{ nextLesson.building.name }}</b
        ><span>{{ nextLesson.floor }} этаж · {{ nextLesson.room }}</span
        ><v-icon v-if="!preview" :icon="mdiArrowTopRight"
      /></span>
    </component>
  </article>
</template>
