import { useEffect, useState } from "react";
import { globalRoutes, moduleRoutes } from "../app-shell";

type HealthResponse = { data: { status: string; now: string } };

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export function App() {
  const [health, setHealth] = useState<string>("checking");
  const [courses, setCourses] = useState<number>(0);
  const [tasks, setTasks] = useState<number>(0);
  const [agenda, setAgenda] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      const healthRes = await fetch(`${API_BASE}/api/health`);
      const healthJson = (await healthRes.json()) as HealthResponse;
      setHealth(healthJson.data.status);

      const [c, t, a] = await Promise.all([
        fetch(`${API_BASE}/api/course`).then((r) => r.json()),
        fetch(`${API_BASE}/api/study-tasks`).then((r) => r.json()),
        fetch(`${API_BASE}/api/agenda-items`).then((r) => r.json())
      ]);
      setCourses(c.data.length);
      setTasks(t.data.length);
      setAgenda(a.data.length);
    };
    load().catch(() => setHealth("error"));
  }, []);

  return (
    <main className="page">
      <h1>Study System</h1>
      <p>API health: {health}</p>
      <section className="cards">
        <article className="card">课程数: {courses}</article>
        <article className="card">学习任务数: {tasks}</article>
        <article className="card">日程数: {agenda}</article>
      </section>
      <section>
        <h2>模块路由</h2>
        <ul>
          {moduleRoutes.map((x) => (
            <li key={x.path}>
              {x.module}: {x.path}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>全局中心</h2>
        <ul>
          {globalRoutes.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
