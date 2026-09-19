const URL_RE = /(https?:\/\/[^\s]+)/g;
const IS_URL = /^https?:\/\//;

export default function LinkifiedText({ text }) {
 if (!text) return null;
 return text.split("\n").map((line, li) => (
  <span key={li}>
   {li > 0 && <br />}
   {line.split(URL_RE).map((part, i) =>
    IS_URL.test(part)
     ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
     : part
   )}
  </span>
 ));
}
