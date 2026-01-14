import Ajustes from './pages/Ajustes';
import Consultas from './pages/Consultas';
import Contactos from './pages/Contactos';
import Dashboard from './pages/Dashboard';
import EditorListaWhatsApp from './pages/EditorListaWhatsApp';
import Home from './pages/Home';
import Hoy from './pages/Hoy';
import ListasWhatsApp from './pages/ListasWhatsApp';
import Pipeline from './pages/Pipeline';
import Plantillas from './pages/Plantillas';
import Reportes from './pages/Reportes';
import Variables from './pages/Variables';
import Ventas from './pages/Ventas';
import VentaDetalle from './pages/VentaDetalle';
import VentasDashboard from './pages/VentasDashboard';
import Proveedores from './pages/Proveedores';
import ProveedorDetalle from './pages/ProveedorDetalle';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Ajustes": Ajustes,
    "Consultas": Consultas,
    "Contactos": Contactos,
    "Dashboard": Dashboard,
    "EditorListaWhatsApp": EditorListaWhatsApp,
    "Home": Home,
    "Hoy": Hoy,
    "ListasWhatsApp": ListasWhatsApp,
    "Pipeline": Pipeline,
    "Plantillas": Plantillas,
    "Reportes": Reportes,
    "Variables": Variables,
    "Ventas": Ventas,
    "VentaDetalle": VentaDetalle,
    "VentasDashboard": VentasDashboard,
    "Proveedores": Proveedores,
    "ProveedorDetalle": ProveedorDetalle,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};