export async function enter({
  signing,
  login,
  loginRole,
  password,
  token,
  role,
  connectionIssue,
  say
}) {
  if (signing.value) return;
  signing.value = true;
  try {
    await login(loginRole.value, password.value);
    password.value = "";
  } catch (e) {
    if (token.value && !role.value) connectionIssue.value = true;
    say(e.message);
  } finally {
    signing.value = false;
  }
}
export async function reconnectCabinet({
  token,
  refresh,
  role,
  connectionIssue
}) {
  if (!token.value) return;
  try {
    await refresh({
      background: true
    });
    if (role.value) connectionIssue.value = false;
  } catch {
    if (token.value && !role.value) connectionIssue.value = true;
  }
}
