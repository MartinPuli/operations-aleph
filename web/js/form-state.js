/** Form values that may safely survive the console's live DOM refresh. */
const restorable = (field) => field.id && field.type !== 'file' && field.type !== 'password' && !field.hasAttribute('data-no-restore');

export function captureFieldValues(root) {
  const saved = Object.create(null);
  for (const field of root.querySelectorAll('input, textarea, select')) {
    // This guard runs before reading value: secrets and browser file handles
    // never enter the snapshot that an unrelated audit event can restore.
    if (!restorable(field)) continue;
    saved[field.id] = { value: field.value, checked: field.checked, start: field.selectionStart, end: field.selectionEnd };
  }
  return saved;
}

export function restoreFieldValues(root, saved) {
  for (const field of root.querySelectorAll('input, textarea, select')) {
    if (!restorable(field) || !Object.hasOwn(saved, field.id)) continue;
    const previous = saved[field.id];
    if (field.type === 'checkbox' || field.type === 'radio') field.checked = previous.checked;
    if (field.value === previous.value) continue;
    // A provider change can remove a select option. Restoring it would make
    // the displayed selection empty even though a new default was rendered.
    if (field.tagName === 'SELECT' && ![...field.options].some((option) => option.value === previous.value)) continue;
    field.value = previous.value;
    if (previous.start != null && field.setSelectionRange) {
      try { field.setSelectionRange(previous.start, previous.end); } catch { /* Some controls have no caret. */ }
    }
  }
}
