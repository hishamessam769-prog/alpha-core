const URL_PATTERN = /(https?:\/\/[^\s)\]]+)/g;
const IMAGE_PATTERN = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i;
const VIDEO_PATTERN = /\.(mp4|webm|ogv|ogg|mov)(\?.*)?$/i;

function cleanUrl(value) {
  return String(value || "").replace(/[.,;:!?]+$/, "");
}

function videoEmbed(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function renderInline(text) {
  const parts = String(text || "").split(URL_PATTERN);
  return parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    const url = cleanUrl(part);
    return <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">{url}</a>;
  });
}

export default function RichArticleContent({ sections = [] }) {
  const normalized = sections.filter((section) => section?.body || section?.title);
  return (
    <div className="rich-article-content-v32">
      {normalized.map((section, sectionIndex) => {
        const lines = String(section.body || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
        const media = lines.map(cleanUrl).filter((line) => /^https?:\/\//i.test(line));
        const bodyLines = lines.filter((line) => !media.includes(cleanUrl(line)));
        return (
          <section key={`${section.title || "section"}-${sectionIndex}`}>
            {section.eyebrow && <span className="eyebrow">{section.eyebrow}</span>}
            {section.title && <h2>{section.title}</h2>}
            <div className="rich-copy-v32">
              {bodyLines.map((line, index) => {
                const bullet = /^[-•*]\s+/.test(line);
                const numbered = /^\d+[.)]\s+/.test(line);
                const cleaned = line.replace(/^([-•*]|\d+[.)])\s+/, "");
                if (bullet || numbered) return <div className="rich-bullet-v32" key={index}><i>{numbered ? line.match(/^\d+/)?.[0] : "•"}</i><p>{renderInline(cleaned)}</p></div>;
                return <p key={index}>{renderInline(line)}</p>;
              })}
            </div>
            {media.map((url, index) => {
              const embed = videoEmbed(url);
              if (embed) return <div className="rich-video-v32" key={url}><iframe src={embed} title={`Article video ${index + 1}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>;
              if (IMAGE_PATTERN.test(url)) return <figure className="rich-image-v32" key={url}><img src={url} alt="" loading="lazy"/><figcaption>Source media</figcaption></figure>;
              if (VIDEO_PATTERN.test(url)) return <div className="rich-video-v32" key={url}><video src={url} controls preload="metadata" playsInline>Direct article video</video></div>;
              return <a className="rich-source-link-v32" key={url} href={url} target="_blank" rel="noreferrer">Open referenced source</a>;
            })}
          </section>
        );
      })}
    </div>
  );
}
