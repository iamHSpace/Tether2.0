import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import AdminSidebar from "@/components/layout/AdminSidebar";

export const metadata = { title: "Admin — Statvora" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.user_metadata?.is_admin) {
    const userType = user.user_metadata?.user_type ?? "creator";
    redirect(userType === "business" ? "/discover" : "/dashboard");
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <AdminSidebar
        email={user.email}
        displayName={user.user_metadata?.full_name ?? user.user_metadata?.username ?? user.email}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
