import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, Kanban, List, Users, MessageSquare, Calendar,
  Menu, X, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const NAV_ITEMS = [
  { name: "Home", icon: LayoutDashboard, page: "Home" },
  { name: "Pipeline", icon: Kanban, page: "Pipeline" },
  { name: "Consultas", icon: List, page: "Consultas" },
  { name: "Ventas", icon: LayoutDashboard, page: "Ventas" },
  { name: "Proveedores", icon: Users, page: "Proveedores" },
  { name: "Hoy", icon: Calendar, page: "Hoy" },
  { name: "Contactos", icon: Users, page: "Contactos" },
  { name: "Plantillas", icon: MessageSquare, page: "Plantillas" },
  { name: "Listas WhatsApp", icon: MessageSquare, page: "ListasWhatsApp" },
  { name: "Ajustes", icon: Users, page: "Ajustes" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" richColors />
      
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-slate-900">TechCRM</span>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-50 transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="font-bold text-slate-900">TechCRM</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <nav className="px-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive 
                    ? "bg-slate-900 text-white" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Quick Stats */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 text-white">
            <p className="text-xs text-slate-400 mb-1">Mini CRM</p>
            <p className="text-sm font-medium">Seguimiento de ventas</p>
            <p className="text-xs text-slate-400 mt-2">WhatsApp · Tecnología</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64">
        {children}
      </main>
    </div>
  );
}