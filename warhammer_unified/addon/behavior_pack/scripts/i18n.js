// Двуязычные сообщения: скрипт шлёт не готовый текст, а ключ перевода (RawMessage), а клиент игрока подставляет
// строку из своего языка (RP/texts/en_US.lang или ru_RU.lang). Список строк — tools/messages.py.

// T(`hyd.cut`, 3) даёт RawMessage с ключом перевода cb.msg.hyd.cut и аргументом 3. Аргументы — строки, числа или другие RawMessage.
export function T(key, ...args) {
  const m = { translate: `cb.msg.${key}` };
  if (args.length) {
    m.with = args.every((a) => typeof a !== "object" || a === null)
      ? args.map((a) => String(a ?? ""))
      : { rawtext: args.map((a) => (a && typeof a === "object" ? a : { text: String(a ?? "") })) };
  }
  return m;
}

// J("текст", T("..."), ...) — склейка кусков в одно сообщение.
export const J = (...parts) => ({ rawtext: parts.map((p) => (p && typeof p === "object" ? p : { text: String(p ?? "") })) });

// Список кусков через разделитель.
export function joinWith(sep, list) {
  const out = [];
  list.forEach((x, i) => { if (i) out.push({ text: sep }); out.push(x && typeof x === "object" ? x : { text: String(x ?? "") }); });
  return { rawtext: out };
}
