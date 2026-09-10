const fs = require('fs');
const path = 'src/app/[categoria]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace Header with a gorgeous Modern Header
const newHeader = `
      <Header />
      <main className="min-h-screen bg-tierra-50 pb-20">
        <header className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <h1 className="font-display text-6xl md:text-[100px] leading-[0.85] tracking-tight text-oliva-950 mb-6">
              {info.nombre}
            </h1>
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-oliva-700">
              {info.descripcion}
            </p>
          </div>
        </header>

        <div className="sticky top-0 z-30 w-full border-b border-oliva-100/50 bg-white/80 backdrop-blur-xl mb-12 shadow-sm">
`;
content = content.replace(
  /<main>\s*<header className="mx-auto max-w-6xl px-6 py-10">\s*<h1 className="font-display text-4xl font-semibold text-oliva-900">\s*\{info\.nombre\}\s*<\/h1>\s*<p className="mt-2 max-w-2xl text-oliva-700">\s*\{info\.descripcion\}\s*<\/p>\s*<\/header>\s*<div className="border-y border-oliva-100 bg-white shadow-sm">/,
  newHeader
);

// We need to fix the rest of the file layout. I'll just write a script to replace the entire return block.
