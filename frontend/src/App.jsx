import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import IssuePage from "./pages/IssuePage";
import VerifyPage from "./pages/VerifyPage";
import ResultPage from "./pages/ResultPage";
import AdminDashboard from "./pages/AdminDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import EmployerDashboard from "./pages/EmployerDashboard";

function ProtectedRoute({ element, role }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (!token) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/login" />;
  return element;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/issue" element={<IssuePage />} />
        <Route path="/admin" element={<ProtectedRoute element={<AdminDashboard />} role="admin" />} />
        <Route path="/student" element={<ProtectedRoute element={<StudentDashboard />} role="student" />} />
        <Route path="/employer" element={<ProtectedRoute element={<EmployerDashboard />} role="employer" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}