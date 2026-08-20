interface Props {
  className?: string;
}

// Bloque de carga en la paleta del proyecto — mismo patrón que ya usaba
// MapaExperiencia.tsx para el fallback de next/dynamic (animate-pulse +
// rounded-2xl + bg-oliva-100), reutilizado aquí en los loading.tsx de
// cada ruta en vez de un spinner genérico.
export default function Skeleton({ className = "" }: Props) {
  return <div className={`animate-pulse rounded-2xl bg-oliva-100 ${className}`} />;
}
