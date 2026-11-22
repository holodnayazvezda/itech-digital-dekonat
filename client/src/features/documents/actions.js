export function chooseService({
  docName,
  goPage
}, name) {
  docName.value = name;
  goPage("service-request", name);
}
export function openRecord({
  recordId,
  reason,
  open
}, r) {
  if (!r) return;
  recordId.value = r.id;
  reason.value = "";
  open("record");
}
export async function submitRequest({
  perform,
  page,
  pages,
  navigation,
  currentNavigation,
  recordId,
  stack,
  panel,
  say
}, data, options) {
  const result = await perform("request", data, options);
  if (!result) return;
  if (data.kind === "document" && page.value?.view === "service-request") {
    pages.value = [...pages.value.slice(0, -1), {
      view: "booked",
      peer: ""
    }];
    void navigation.write(currentNavigation(), {
      replace: true
    });
    window.scrollTo(0, 0);
  }
  recordId.value = result.id;
  stack.value = [];
  panel.value = "record";
  say("Заявка направлена в деканат");
  return result;
}
export async function caseReply({
  reason,
  perform,
  recordId,
  say
}, command, body = reason.value, attachment = null) {
  if (await perform(command, {
    id: recordId.value,
    body,
    ...(attachment ? {
      attachment
    } : {})
  })) {
    reason.value = "";
    say("Сведения отправлены");
  }
}
export async function decide({
  perform,
  recordId,
  reason,
  say
}, status) {
  if (await perform("decision", {
    id: recordId.value,
    status,
    reason: reason.value
  })) say("Решение отправлено");
}
export async function sendLetter({
  perform,
  letterTo,
  letterSubject,
  letterBody,
  close,
  say
}) {
  if (await perform("letter", {
    to: letterTo.value,
    subject: letterSubject.value,
    body: letterBody.value
  })) {
    letterSubject.value = "";
    letterBody.value = "";
    close();
    say("Письмо отправлено");
  }
}
