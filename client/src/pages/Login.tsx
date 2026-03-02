import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

// Colores de marca InstaDetox
const COLORS = {
  uiBackground: "#020617", // slate-950
  cardBackground: "#0f172a", // slate-900
  primaryButtonBackground: "#10b981", // emerald-500
  primaryButtonHover: "#059669", // emerald-600
  primaryButtonText: "#f8fafc", // slate-50
  inputBackground: "rgba(15, 23, 42, 0.6)",
  inputBorderColor: "#3D4F5C",
  inputBorderFocus: "#10b981",
  primaryText: "#f8fafc", // slate-50
  secondaryText: "#94a3b8", // slate-400
  accentText: "#10b981", // emerald-500
  linkColor: "#38bdf8", // sky-400
  divider: "#334155", // slate-700
};

// Componente de Input con Label Flotante
interface FloatingInputProps {
  id: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}

const FloatingInput = ({ id, type, value, onChange, label, disabled = false }: FloatingInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.length > 0;
  const isActive = isFocused || hasValue;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        className="w-full h-[56px] px-4 pt-5 pb-2 text-[15px] font-normal rounded-[12px] outline-none transition-all duration-200 bg-slate-900/60"
        style={{
          border: `1px solid ${isFocused ? COLORS.inputBorderFocus : COLORS.inputBorderColor}`,
          color: COLORS.primaryText,
        }}
      />
      <label
        htmlFor={id}
        className="absolute left-4 pointer-events-none transition-all duration-200"
        style={{
          top: isActive ? "8px" : "50%",
          transform: isActive ? "translateY(0)" : "translateY(-50%)",
          fontSize: isActive ? "12px" : "15px",
          color: isFocused ? COLORS.accentText : COLORS.secondaryText,
          fontWeight: isActive ? 400 : 500,
        }}
      >
        {label}
      </label>
    </div>
  );
};

// Links del footer simplificados
const footerLinks = [
  { label: "Inicio", href: "/" },
  { label: "Sobre nosotros", href: "/about" },
  { label: "Privacidad", href: "/legal/privacy/" },
  { label: "Términos", href: "/legal/terms/" },
  { label: "Contacto", href: "/contact" },
];

const Login = () => {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Limpiar error cuando cambian los inputs
  useEffect(() => {
    setLocalError(null);
  }, [email, password]);

  const isFormValid = email.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !isFormValid) return;

    setIsSubmitting(true);
    setLocalError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col font-sans"
      style={{ backgroundColor: COLORS.uiBackground }}
    >
      {/* Contenido Principal */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-[1000px] flex items-center justify-center gap-8 lg:gap-16">
          {/* Columna Izquierda - Hero (Oculto en mobile) */}
          <div className="hidden lg:flex flex-1 flex-col items-start justify-center">
            {/* Logo InstaDetox */}
            <div className="mb-8">
              <img
                src="/brand-wordmark.png"
                alt="InstaDetox"
                className="h-12 w-auto object-contain"
              />
            </div>

            {/* Headline */}
            <h1
              className="text-[32px] sm:text-[36px] lg:text-[42px] font-bold leading-tight mb-6 max-w-[480px]"
              style={{ color: COLORS.primaryText }}
            >
              Tu espacio digital{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #10b981, #34d399)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                libre de toxicidad
              </span>
            </h1>

            {/* Descripción */}
            <p
              className="text-[16px] leading-relaxed mb-8 max-w-[420px]"
              style={{ color: COLORS.secondaryText }}
            >
              Conecta con personas que comparten valores positivos. Un lugar donde el respeto y la autenticidad son la norma.
            </p>

            {/* Mockup de App */}
            <div className="relative mt-4">
              <div
                className="rounded-[24px] overflow-hidden shadow-2xl"
                style={{
                  boxShadow: "0 25px 50px -12px rgba(16, 185, 129, 0.15)",
                }}
              >
                <img
                  src="/fondoappinstadetox.jpg"
                  alt="InstaDetox App Preview"
                  className="w-[320px] h-auto object-cover"
                />
              </div>
              {/* Decoración de fondo */}
              <div
                className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl"
                style={{
                  background: "radial-gradient(circle, #10b981 0%, transparent 70%)",
                }}
              />
            </div>
          </div>

          {/* Columna Derecha - Formulario */}
          <div className="w-full max-w-[400px]">
            {/* Logo Mobile (solo en pantallas pequeñas) */}
            <div className="flex lg:hidden justify-center mb-8">
              <img
                src="/brand-icon.png"
                alt="InstaDetox"
                className="h-16 w-auto object-contain"
              />
            </div>

            {/* Tarjeta del Formulario */}
            <div
              className="p-8 rounded-[20px]"
              style={{ backgroundColor: COLORS.cardBackground }}
            >
              {/* Título */}
              <h2
                className="text-[22px] font-bold text-center mb-6"
                style={{ color: COLORS.primaryText }}
              >
                Iniciar sesión en InstaDetox
              </h2>

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <FloatingInput
                  id="email"
                  type="text"
                  value={email}
                  onChange={setEmail}
                  label="Usuario o correo electrónico"
                  disabled={isSubmitting || loading}
                />

                <FloatingInput
                  id="password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  label="Contraseña"
                  disabled={isSubmitting || loading}
                />

                {/* Botón Login */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!isFormValid || isSubmitting || loading}
                    className="w-full h-[48px] rounded-[24px] font-semibold text-[16px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{
                      backgroundColor: COLORS.primaryButtonBackground,
                      color: COLORS.primaryButtonText,
                    }}
                  >
                    {isSubmitting || loading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin h-5 w-5 mr-2"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Iniciando...
                      </span>
                    ) : (
                      "Iniciar sesión"
                    )}
                  </button>
                </div>

                {/* Link Olvidaste contraseña */}
                <div className="flex justify-center pt-1">
                  <a
                    href="#"
                    className="text-[14px] font-medium hover:underline transition-colors"
                    style={{ color: COLORS.linkColor }}
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Función no disponible en esta versión");
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>

                {/* Mensaje de Error */}
                {(error || localError) && (
                  <div
                    className="p-3 rounded-lg text-[14px] text-center mt-4"
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                    }}
                  >
                    {error?.message || localError}
                  </div>
                )}
              </form>

              {/* Separador */}
              <div className="flex items-center my-6">
                <div
                  className="flex-1 h-[1px]"
                  style={{ backgroundColor: COLORS.divider }}
                />
                <span
                  className="px-4 text-[13px] font-medium"
                  style={{ color: COLORS.secondaryText }}
                >
                  o
                </span>
                <div
                  className="flex-1 h-[1px]"
                  style={{ backgroundColor: COLORS.divider }}
                />
              </div>

              {/* Botón Crear Cuenta */}
              <button
                className="w-full h-[48px] rounded-[24px] font-semibold text-[15px] transition-all duration-200 hover:opacity-80 border-2"
                style={{
                  backgroundColor: "transparent",
                  borderColor: COLORS.inputBorderFocus,
                  color: COLORS.accentText,
                }}
                onClick={() => alert("Registro no disponible en esta versión")}
              >
                Crear cuenta nueva
              </button>
            </div>

            {/* Tagline Mobile */}
            <div className="lg:hidden mt-8 text-center">
              <p
                className="text-[14px]"
                style={{ color: COLORS.secondaryText }}
              >
                Tu espacio digital libre de toxicidad
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-6 px-4">
        <div className="max-w-[1000px] mx-auto">
          {/* Links del Footer */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[13px] hover:underline transition-colors"
                style={{ color: COLORS.secondaryText }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <div className="text-center">
            <span
              className="text-[13px]"
              style={{ color: COLORS.secondaryText }}
            >
              © 2026 InstaDetox
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;
