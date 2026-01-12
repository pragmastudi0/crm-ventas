import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Consultas from './pages/Consultas';
import Plantillas from './pages/Plantillas';
import Contactos from './pages/Contactos';
import Home from './pages/Home';
import Hoy from './pages/Hoy';
import Reportes from './pages/Reportes';
import Ajustes from './pages/Ajustes';
import Variables from './pages/Variables';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Pipeline": Pipeline,
    "Consultas": Consultas,
    "Plantillas": Plantillas,
    "Contactos": Contactos,
    "Home": Home,
    "Hoy": Hoy,
    "Reportes": Reportes,
    "Ajustes": Ajustes,
    "Variables": Variables,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};