import { AuthPage } from "./pages/auth/AuthPage";
import { HomePage } from "./pages/home/HomePage";

export default function App() {
  const pathname = window.location.pathname;

  if (pathname === "/login") {
    return <AuthPage mode="login" />;
  }

  if (pathname === "/register") {
    return <AuthPage mode="register" />;
  }

  return <HomePage />;
}
