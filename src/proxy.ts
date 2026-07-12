import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, request) => {
  const locale = request.nextUrl.pathname.split("/")[1] === "en" ? "en" : "bn";
  await auth.protect({
    unauthenticatedUrl: new URL(`/${locale}/sign-in`, request.url).toString(),
  });
});

export const config = {
  matcher: [
    "/:locale(bn|en)/:role(owner|teacher|student)",
    "/:locale(bn|en)/:role(owner|teacher|student)/:path*",
  ],
};
