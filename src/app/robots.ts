import type { MetadataRoute } from "next";
import { urlSitio } from "@/lib/sitio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Lo privado o sin valor de búsqueda: paneles, cuenta, resultados
      // de búsqueda (contenido duplicado de las categorías) y auth. Y
      // cualquier URL con parámetros: los filtros de las categorías
      // combinan en millones de URLs y un rastreador se queda a vivir
      // (ClaudeBot: 221.000 peticiones a /gastronomia en 12 h).
      disallow: [
        "/admin/", "/panel/", "/perfil", "/favoritos", "/mis-resenas", "/buscar", "/auth/", "/login", "/registro", "/recuperar", "/nueva-contrasena",
        "/*?*",
      ],
    },
    sitemap: `${urlSitio()}/sitemap.xml`,
  };
}
