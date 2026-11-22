export async function resetWifi({
  perform,
  say
}) {
  const result = await perform("reset-wifi", {});
  if (result) say("Новый пароль готов. Активация примерно через 5 минут.");
  return Boolean(result);
}
export async function copy({
  wifiPassword,
  say
}) {
  try {
    await navigator.clipboard.writeText(wifiPassword.value);
    say("Демо-пароль скопирован");
  } catch {
    say("Не удалось скопировать. Откройте поле и выделите пароль.");
  }
}
