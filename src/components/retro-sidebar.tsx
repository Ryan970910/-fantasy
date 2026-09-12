import { AppNavigation } from "@/components/app-navigation";

export function RetroSidebar() {
  return <aside className="reference-sidebar" aria-label="梦幻篮球">
    <div className="reference-sidebar-art"><AppNavigation sidebar /></div>
  </aside>;
}
