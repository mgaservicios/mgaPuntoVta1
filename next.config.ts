import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/dashboard/ordenes/:path*',        destination: '/dashboard/ventas/ordenes/:path*',        permanent: true },
      { source: '/dashboard/notas-credito/:path*',  destination: '/dashboard/ventas/notas-credito/:path*',  permanent: true },
      { source: '/dashboard/clientes/:path*',       destination: '/dashboard/ventas/clientes/:path*',       permanent: true },
      { source: '/dashboard/articulos/:path*',      destination: '/dashboard/inventario/articulos/:path*',  permanent: true },
      { source: '/dashboard/stock/:path*',          destination: '/dashboard/inventario/remitos/:path*',    permanent: true },
      { source: '/dashboard/proveedores/:path*',    destination: '/dashboard/inventario/proveedores/:path*', permanent: true },
      { source: '/consulta-stock',                   destination: '/dashboard/consultas/stock',              permanent: true },
      { source: '/dashboard/inventario/consulta',   destination: '/dashboard/consultas/stock',              permanent: true },
      { source: '/dashboard/inventario/articulos/seguimiento', destination: '/dashboard/consultas/seguimiento', permanent: true },
    ]
  },
};

export default nextConfig;
