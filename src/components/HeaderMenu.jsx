import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export default function HeaderMenu({ label, icon: Icon, children, align = "start", className = "" }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const closeOutside = (event) => {
      if (menuRef.current?.open && !menuRef.current.contains(event.target)) menuRef.current.removeAttribute("open");
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.removeAttribute("open");
        menuRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const closeAfterAction = (event) => {
    if (event.target.closest("a, button")) requestAnimationFrame(() => menuRef.current?.removeAttribute("open"));
  };

  return (
    <details ref={menuRef} className={`header-menu-v34 ${className}`}>
      <summary>
        {Icon && <Icon size={15}/>}<span>{label}</span><ChevronDown size={13}/>
      </summary>
      <div onClick={closeAfterAction} className={`header-menu-panel-v34 ${align === "end" ? "align-end" : ""}`}>{children}</div>
    </details>
  );
}
