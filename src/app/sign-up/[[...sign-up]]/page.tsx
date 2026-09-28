import { SignUp } from "@clerk/nextjs";
import { AuthShell, authAppearance } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <AuthShell mode="sign-up">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" appearance={authAppearance} />
    </AuthShell>
  );
}
