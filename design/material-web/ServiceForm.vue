<script setup>
import { computed, reactive, ref } from "vue";
import { services, choices, submittedFields } from "./services.js";
import { transferRequirements } from "./university.js";
const props = defineProps({ name: String, person: Object, busy: Boolean });
const emit = defineEmits(["submit"]);
const service = services.find((s) => s.name === props.name);
const values = reactive({
  group: props.person.unit,
  email: props.person.id + "@campus.example",
});
const attachment = ref(null),
  reading = ref(false);
async function attach(e) {
  const file = e.target.files[0];
  attachment.value = null;
  error.value = "";
  if (!file) return;
  if (
    file.size > 2097152 ||
    !["image/png", "application/pdf", "image/jpeg"].includes(file.type)
  ) {
    error.value = "Выберите PDF, PNG или JPEG размером до 2 МБ";
    e.target.value = "";
    return;
  }
  reading.value = true;
  try {
    const data = await new Promise((ok, fail) => {
      const reader = new FileReader();
      reader.onload = () => ok(reader.result);
      reader.onerror = fail;
      reader.readAsDataURL(file);
    });
    attachment.value = {
      name: file.name,
      mime: file.type,
      base64: data.split(",")[1],
    };
  } catch {
    error.value = "Не удалось прочитать вложение";
    e.target.value = "";
  } finally {
    reading.value = false;
  }
}
const format = ref("Электронная"),
  comment = ref(""),
  error = ref("");
const requirements = computed(() =>
  transferRequirements(values.program, props.person),
);
function submit() {
  try {
    submittedFields(service, values, props.person);
    error.value = "";
    emit("submit", {
      kind: "document",
      name: service.name,
      format: format.value,
      values: { ...values },
      comment: comment.value,
      attachment: attachment.value,
    });
  } catch (e) {
    error.value = e.message;
  }
}
</script>
<template>
  <form class="hub-form" @submit.prevent="submit">
    <p class="form-applicant">
      <strong>{{ person.name }}</strong
      ><br />{{ person.program }} · {{ person.unit }}
    </p>
    <label class="field" v-if="service.certificate"
      >Формат<select v-model="format">
        <option>Электронная</option>
        <option>Бумажная</option>
      </select></label
    >
    <template v-for="f in service.fields" :key="f.id">
      <label class="field"
        >{{ f.label }}
        <select v-if="choices(f, person)" v-model="values[f.id]" required>
          <option disabled value="">Выберите из списка</option>
          <option v-for="o in choices(f, person)" :key="o">{{ o }}</option>
        </select>
        <textarea
          v-else-if="f.type === 'textarea'"
          v-model="values[f.id]"
          required
          maxlength="2000"
          rows="3"
        ></textarea>
        <input
          v-else
          :type="f.type"
          v-model="values[f.id]"
          required
          maxlength="200"
          :min="f.id === 'end' ? values.start : undefined"
        />
      </label>
      <section
        v-if="f.type === 'program' && requirements.length"
        class="transfer-box"
      >
        <h3>Академическая разница</h3>
        <div v-for="r in requirements" :key="r.subject">
          <span>{{ r.subject }}</span
          ><b>{{ r.met ? "Зачтено" : "Пройти аттестацию" }}</b>
        </div>
        <p>
          По правилам демонстрационной программы минимум по недостающим
          дисциплинам — 60 из 100 баллов. После аттестации комиссия проводит
          собеседование. Решение появится в заявке.
        </p>
      </section>
    </template>
    <label v-if="!service.certificate" class="field"
      >Подтверждающий документ (по желанию)<input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        @change="attach"
      /><small>PDF, PNG или JPEG, до 2 МБ</small></label
    >
    <label class="field"
      >Комментарий (по желанию)<textarea
        v-model="comment"
        rows="2"
        maxlength="2500"
      ></textarea>
    </label>
    <p v-if="error" role="alert">{{ error }}</p>
    <button class="campus-action" :disabled="busy || reading">
      Отправить заявку
    </button>
  </form>
</template>
