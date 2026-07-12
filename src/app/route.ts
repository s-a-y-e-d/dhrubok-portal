import { NextResponse } from "next/server";
import { defaultLocale } from "@/lib/i18n/config";

export function GET(request: Request) {
  return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
}
