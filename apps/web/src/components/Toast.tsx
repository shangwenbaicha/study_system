import { useEffect, useState } from "react";

export interface ToastMessage {
  id: number;
  type: "success" | "error";
  text: string;
}

let toastId = 0;
let addToastFn: ((msg: Omit<ToastMessage, "id">) => void) | null = null;

export function showToast(type: "success" | "error", text: string) {
  addToastFn?.({ type, text });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastFn = (msg) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { ...msg, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => {
      addToastFn = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" ? "✅" : "❌"} {t.text}
        </div>
      ))}
    </div>
  );
}
