import { urlSitio } from "@/lib/sitio";
import { horarioSchema } from "@/lib/horario";
import { usuarioInstagram, urlPaginaFacebook } from "@/lib/redes-publicas";
import type { Categoria } from "@/types";

// Títulos y descripciones con intención de búsqueda. La gente no busca
// "Gastronomía · Jaén Guía": busca "bares en Jaén" o "qué ver en Jaén".
// El nombre corto de la categoría (tabla `categorias`) sigue valiendo
// para el menú y las migas; esto es solo lo que lee Google.
//
// Datos estructurados (JSON-LD) en el mismo sitio: los tipos de
// schema.org se eligen a partir de lo que ya sabemos del negocio
// (categoría + tipos de Google en `tipo_cocina`). Sin AggregateRating a
// propósito: con dos reseñas queda peor que sin nada; añadirlo cuando
// haya volumen real.

export const NOMBRE_SITIO = "Jaén Guía";

export const SEO_RAIZ = {
  titulo: "Bares, restaurantes y qué hacer en Jaén · Jaén Guía",
  descripcion:
    "Qué hacer en Jaén hoy y este fin de semana: bares de tapas, restaurantes, eventos, monumentos, naturaleza y comercio local. Guía hecha en Jaén, por jiennenses.",
};

export const SEO_CATEGORIA: Record<string, { titulo: string; descripcion: string }> = {
  gastronomia: {
    titulo: "Bares y restaurantes en Jaén: dónde comer y tapear",
    descripcion:
      "Bares de tapas, restaurantes y cafeterías de Jaén con horario, dirección y opiniones. Del tapeo del centro al aceite de oliva virgen extra.",
  },
  cultura: {
    titulo: "Qué ver en Jaén: monumentos, museos y cultura",
    descripcion:
      "Catedral, Baños Árabes, castillo de Santa Catalina, museos y actividades culturales para conocer la historia y el arte de Jaén.",
  },
  naturaleza: {
    titulo: "Naturaleza en Jaén: parques, miradores y senderos",
    descripcion:
      "Rutas de senderismo, miradores, parques y turismo rural alrededor de Jaén capital, con cómo llegar y qué esperar.",
  },
  tiendas: {
    titulo: "Tiendas en Jaén: comercio local con identidad",
    descripcion: "Comercio local de Jaén capital: tiendas de barrio, artesanía, productos de la tierra y negocios con nombre propio.",
  },
  experiencias: {
    titulo: "Planes y experiencias en Jaén: qué hacer",
    descripcion: "Ocio, actividades y planes para vivir Jaén de otra forma: con niños, en pareja o con amigos, de día y de noche.",
  },
};

export function tituloCategoria(slug: string, nombre: string) {
  return SEO_CATEGORIA[slug]?.titulo ?? `${nombre} en Jaén`;
}

// ---------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------

type Json = Record<string, unknown>;

/** `<script type="application/ld+json">`. Escapa `<` como recomienda Next para evitar inyección. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

function absoluta(ruta: string) {
  return ruta.startsWith("http") ? ruta : `${urlSitio()}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
}

const DIRECCION_JAEN = { addressLocality: "Jaén", addressRegion: "Jaén", addressCountry: "ES" } as const;

/** Organization + WebSite (con buscador) para la portada. */
export function organizacionJsonLd(): Json[] {
  const url = urlSitio();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}/#organizacion`,
      name: NOMBRE_SITIO,
      url,
      logo: `${url}/icon.svg`,
      email: "hola@jaenguia.com",
      areaServed: { "@type": "City", name: "Jaén" },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}/#web`,
      name: NOMBRE_SITIO,
      url,
      inLanguage: "es",
      publisher: { "@id": `${url}/#organizacion` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${url}/buscar?q={consulta}` },
        "query-input": "required name=consulta",
      },
    },
  ];
}

export function migasJsonLd(migas: Array<{ nombre: string; ruta: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nombre,
      item: absoluta(m.ruta),
    })),
  };
}

/** Listado de una categoría: los negocios de la página actual, en orden. */
export function listaJsonLd(nombre: string, items: Array<{ nombre: string; ruta: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nombre,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.nombre,
      url: absoluta(it.ruta),
    })),
  };
}

interface NegocioSeo {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  web: string | null;
  horario: Record<string, string> | null;
  imagen_portada: string | null;
  google_photo_name: string | null;
  rango_precio: string | null;
  tipo_cocina: string[];
  instagram: string | null;
  facebook?: string | null;
  categoria: { nombre: string; tipo: Categoria["tipo"] } | null;
}

// Tipo schema.org más concreto que podamos justificar con los datos.
// `tipo_cocina` trae los tipos de Google en castellano ("Bar",
// "Cafetería", "Museo", "Parque"...). Si nada encaja, LocalBusiness
// (o TouristAttraction para lo que no es negocio).
function tipoSchema(n: NegocioSeo): string {
  const tipos = n.tipo_cocina.map((t) => t.toLowerCase());
  const tiene = (...claves: string[]) => tipos.some((t) => claves.some((c) => t.includes(c)));
  switch (n.categoria?.tipo) {
    case "comer_beber":
      if (tiene("cafetería", "cafeteria", "café")) return "CafeOrCoffeeShop";
      if (tiene("bar", "pub", "taberna", "cervecería")) return "BarOrPub";
      return "Restaurant";
    case "tienda":
      return "Store";
    case "cultura":
      if (tiene("museo")) return "Museum";
      if (tiene("iglesia", "catedral")) return "Church";
      if (tiene("lugar de interés", "atracción", "castillo", "escultura", "mirador")) return "TouristAttraction";
      return "LocalBusiness";
    case "naturaleza":
      if (tiene("parque")) return "Park";
      return "TouristAttraction";
    case "ocio":
      return "EntertainmentBusiness";
    default:
      return "LocalBusiness";
  }
}

/** Imagen pública de la ficha: la portada subida o, si no, la de Google vía nuestro proxy. */
export function imagenNegocio(n: Pick<NegocioSeo, "id" | "imagen_portada" | "google_photo_name">) {
  if (n.imagen_portada) return absoluta(n.imagen_portada);
  if (n.google_photo_name) return `${urlSitio()}/api/foto-negocio/${n.id}?w=1200`;
  return null;
}

export function negocioJsonLd(n: NegocioSeo): Json {
  const tipo = tipoSchema(n);
  const esNegocioSchema = !["TouristAttraction", "Park", "Church"].includes(tipo);
  const imagen = imagenNegocio(n);
  const horas = horarioSchema(n.horario);
  const ig = usuarioInstagram(n.instagram);
  const fb = urlPaginaFacebook(n.facebook);
  const sameAs = [n.web, ig && `https://www.instagram.com/${ig}/`, fb].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": tipo,
    "@id": `${urlSitio()}/negocio/${n.slug}#lugar`,
    name: n.nombre,
    description: n.descripcion_corta ?? n.descripcion ?? undefined,
    url: `${urlSitio()}/negocio/${n.slug}`,
    image: imagen ?? undefined,
    telephone: n.telefono ?? undefined,
    address: n.direccion ? { "@type": "PostalAddress", streetAddress: n.direccion, ...DIRECCION_JAEN } : undefined,
    geo: n.lat != null && n.lng != null ? { "@type": "GeoCoordinates", latitude: n.lat, longitude: n.lng } : undefined,
    openingHoursSpecification: horas.length ? horas : undefined,
    priceRange: esNegocioSchema ? n.rango_precio ?? undefined : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

interface EventoSeo {
  slug: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  precio_texto: string | null;
  imagen: string | null;
  lugar_nombre: string | null;
  direccion: string | null;
  fuente_url: string | null;
  negocio: { nombre: string; slug: string } | null;
  /** Los eventos de la provincia se guardan aunque no se listen: el pueblo va en la dirección. */
  municipio?: { nombre: string } | null;
}

export function eventoJsonLd(e: EventoSeo): Json {
  const url = `${urlSitio()}/evento/${e.slug}`;
  const lugar = e.lugar_nombre ?? e.negocio?.nombre ?? "Jaén";
  // Un evento de día completo lleva solo la fecha; con hora, la ISO entera.
  const fecha = (iso: string) => (e.es_todo_el_dia ? iso.slice(0, 10) : iso);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.titulo,
    description: e.descripcion ?? undefined,
    url,
    startDate: fecha(e.fecha_inicio),
    endDate: e.fecha_fin ? fecha(e.fecha_fin) : undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: e.imagen ? absoluta(e.imagen) : undefined,
    location: {
      "@type": "Place",
      name: lugar,
      address: {
        "@type": "PostalAddress",
        streetAddress: e.direccion ?? undefined,
        ...DIRECCION_JAEN,
        addressLocality: e.municipio?.nombre ?? DIRECCION_JAEN.addressLocality,
      },
    },
    // Solo cuando sabemos el precio con certeza (gratis). "5 € con
    // consumición" no se puede expresar como número sin inventar.
    offers: e.es_gratis
      ? { "@type": "Offer", price: 0, priceCurrency: "EUR", availability: "https://schema.org/InStock", url: e.fuente_url ?? url }
      : undefined,
    organizer: e.negocio
      ? { "@type": "Organization", name: e.negocio.nombre, url: `${urlSitio()}/negocio/${e.negocio.slug}` }
      : undefined,
  };
}
