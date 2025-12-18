import { NavLink, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { WeatherPage } from './pages/WeatherPage';
import { FieldsPage } from './pages/FieldsPage';

function Nav() {
  const base = 'px-3 py-2 rounded-md text-sm font-medium';
  const active = 'bg-slate-900 text-white';
  const inactive = 'text-slate-700 hover:bg-slate-200';

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div className="font-semibold">Irrigation Scheduling</div>
        <nav className="flex gap-2">
          <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>Dashboard</NavLink>
          <NavLink to="/weather" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>ET0</NavLink>
          <NavLink to="/fields" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>Fields</NavLink>
        </nav>
      </div>
    </header>
  );
}

export function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/weather" element={<WeatherPage />} />
          <Route path="/fields" element={<FieldsPage />} />
        </Routes>
      </main>
    </div>
  );
}
