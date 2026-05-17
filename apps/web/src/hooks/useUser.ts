import { useState, useEffect } from "react";
import { authApi } from "../api/new-client";

export interface UserInfo {
  id: string;
  email: string;
  displayName: string;
}

/**
 * 获取当前登录用户信息
 * 优先从 localStorage 读取，若不存在则调用 /api/auth/me
 */
export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 如果 localStorage 没有用户信息，尝试从 API 获取
    if (!user) {
      const token = localStorage.getItem("token");
      if (token) {
        setLoading(true);
        authApi
          .me()
          .then((u) => {
            setUser(u);
            localStorage.setItem("user", JSON.stringify(u));
          })
          .catch(() => {
            // token 无效，清除登录状态
            localStorage.removeItem("token");
            localStorage.removeItem("workspaceId");
            localStorage.removeItem("user");
          })
          .finally(() => setLoading(false));
      }
    }
  }, []);

  return { user, loading };
}
