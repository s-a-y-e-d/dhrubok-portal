import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4">
      <SignIn />
    </main>
  );
}
