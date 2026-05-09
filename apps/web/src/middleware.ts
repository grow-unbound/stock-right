import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { ACTIVE_WAREHOUSE_COOKIE_NAME } from "@stockright/shared/utils";

const PUBLIC_PATHS = ["/login", "/signup", "/verify"];

function warehouseCookieOptions(): CookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  async function redirectIfStaffOnMoney(): Promise<NextResponse | null> {
    if (!pathname.startsWith("/money")) return null;
    const { data: allowed } = await supabase.rpc("user_can_manage_money");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return null;
  }

  async function redirectIfNotOwnerOnUsers(): Promise<NextResponse | null> {
    if (!pathname.startsWith("/users")) return null;
    const { data: allowed } = await supabase.rpc("user_can_manage_tenant_users");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return null;
  }

  if (user && !isPublicPath) {
    const blockedUsersEarly = await redirectIfNotOwnerOnUsers();
    if (blockedUsersEarly) return blockedUsersEarly;

    const { data: rows } = await supabase
      .from("user_warehouse_assignments")
      .select("warehouse_id")
      .eq("user_id", user.id);

    const ids = (rows ?? []).map((r) => r.warehouse_id as string);

    if (ids.length === 0) {
      if (!pathname.startsWith("/create-warehouse")) {
        return NextResponse.redirect(new URL("/create-warehouse", request.url));
      }
      const blocked = await redirectIfStaffOnMoney();
      if (blocked) return blocked;
      return response;
    }

    if (ids.length === 1) {
      const existing = request.cookies.get(ACTIVE_WAREHOUSE_COOKIE_NAME)?.value;
      if (!existing || existing !== ids[0]) {
        response.cookies.set(ACTIVE_WAREHOUSE_COOKIE_NAME, ids[0]!, warehouseCookieOptions());
      }
      const blocked = await redirectIfStaffOnMoney();
      if (blocked) return blocked;
      return response;
    }

    const active = request.cookies.get(ACTIVE_WAREHOUSE_COOKIE_NAME)?.value;
    const valid = Boolean(active && ids.includes(active));
    if (!valid && !pathname.startsWith("/warehouse-select")) {
      return NextResponse.redirect(new URL("/warehouse-select", request.url));
    }
  }

  if (user) {
    const blocked = await redirectIfStaffOnMoney();
    if (blocked) return blocked;
    const blockedUsers = await redirectIfNotOwnerOnUsers();
    if (blockedUsers) return blockedUsers;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]*$).*)"],
};
