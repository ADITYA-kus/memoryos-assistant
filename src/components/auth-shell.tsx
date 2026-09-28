import { Logo } from "@/components/site/logo";

type AuthShellProps = {
  children: React.ReactNode;
  mode: "sign-in" | "sign-up";
};

export const authAppearance = {
  variables: {
    colorPrimary: "#9EFF7A",
    colorBackground: "#0c0f12",
    colorInputBackground: "#11161a",
    colorInputText: "#ffffff",
    colorText: "#ffffff",
    colorTextSecondary: "#8b949e",
    borderRadius: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full border border-white/10 bg-white/[0.025] shadow-2xl shadow-black/30",
    headerTitle: "text-white",
    headerSubtitle: "text-white/45",
    socialButtonsBlockButton: "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]",
    formFieldInput: "border-white/10 bg-black/20 text-white",
    formButtonPrimary: "bg-[#9EFF7A] text-[#071008] hover:bg-[#B5FF99]",
    footerActionLink: "text-[#9EFF7A] hover:text-[#B5FF99]",
  },
};

export function AuthShell({ children, mode }: AuthShellProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#07090b] px-5 py-12 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(158,255,122,0.1),transparent_36%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">{mode === "sign-up" ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">Sign in to continue with the same assistant identity and context across sessions.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
