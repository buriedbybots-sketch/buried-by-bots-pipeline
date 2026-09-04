// The Telegram bot, shared by deliver.mjs and geo.mjs. Both are optional:
// with no TG_BOT_TOKEN / TG_CHAT_ID, `telegram()` returns null and the caller
// prints instead of sending.
export const telegram = () => {
  const {TG_BOT_TOKEN, TG_CHAT_ID} = process.env;
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return null;

  const call = async (method, form) => {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/${method}`, {method: 'POST', body: form});
    if (!res.ok) throw new Error(`${method} failed: ${res.status} ${await res.text()}`);
    return res.json();
  };

  return {
    text: (text) => {
      const f = new FormData();
      f.append('chat_id', TG_CHAT_ID);
      f.append('text', text);
      return call('sendMessage', f);
    },
    // sendDocument, not sendVideo: a document arrives byte-exact, a video gets
    // re-encoded into a softer copy of the thing we just rendered.
    file: (name, bytes, type, caption) => {
      const f = new FormData();
      f.append('chat_id', TG_CHAT_ID);
      f.append('document', new Blob([bytes], {type}), name);
      if (caption) f.append('caption', caption);
      return call('sendDocument', f);
    },
  };
};
