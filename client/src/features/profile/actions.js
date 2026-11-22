export async function changeAvatar({
  token,
  say,
  perform
}, event) {
  const auth = token.value;
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    say("Выберите JPG, PNG или WebP");
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (auth !== token.value) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d").drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 192, 192);
    const data = canvas.toDataURL("image/png");
    if (await perform("avatar", {
      image: data
    })) say("Фото профиля обновлено");
  } catch {
    if (auth === token.value) say("Не удалось сохранить фото");
  } finally {
    URL.revokeObjectURL(url);
  }
}
