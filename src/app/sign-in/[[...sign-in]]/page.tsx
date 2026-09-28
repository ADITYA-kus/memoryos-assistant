import { SignIn } from "@clerk/nextjs";
import { AuthShell, authAppearance } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <AuthShell mode="sign-in">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" appearance={authAppearance} />
    </AuthShell>
  );
}
