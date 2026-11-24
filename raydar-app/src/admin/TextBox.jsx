import { useEffect, useRef, useState } from 'react';

/**
 * A text box that keeps exactly what's being typed. The saved value is tidied (trimmed, emoji markers added, lists
 * split on commas), and showing that tidied value while typing swallowed spaces and commas. This box shows the
 * person's own text until they leave it, then shows the saved value again.
 */
export function TextBox({ value, onChange, multiline, ...rest }) {
  const [text, setText] = useState(value ?? '');
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setText(value ?? ''); }, [value]);
  const props = {
    ...rest,
    value: text,
    onFocus: (e) => { editing.current = true; if (rest.onFocus) rest.onFocus(e); },
    onBlur: (e) => { editing.current = false; setText(value ?? ''); if (rest.onBlur) rest.onBlur(e); },
    onChange: (e) => { setText(e.target.value); onChange(e.target.value); },
  };
  return multiline ? <textarea {...props} /> : <input {...props} />;
}
