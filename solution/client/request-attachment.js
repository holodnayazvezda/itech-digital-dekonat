export async function readRequestAttachment(file) {
  const formats = ["image/png", "application/pdf", "image/jpeg"];
  if (file.size > 2 * 1024 * 1024 || !formats.includes(file.type)) {
    throw new Error("Выберите PDF, PNG или JPEG размером до 2 МБ.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать вложение."));
    reader.onload = () => resolve({
      name: file.name,
      mime: file.type,
      base64: reader.result.split(",")[1],
    });
    reader.readAsDataURL(file);
  });
}
