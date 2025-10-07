export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="py-16">
        <div className="container mx-auto px-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Ayuda</h1>
          <p className="text-gray-600 max-w-2xl">
            Encuentra respuestas a preguntas frecuentes o ponte en contacto con nuestro equipo.
            También puedes escribirnos a
            <a href="mailto:soporte@dcconcretos.com.mx" className="text-green-600 hover:text-green-700 ml-1">soporte@dcconcretos.com.mx</a>.
          </p>
        </div>
      </section>
    </div>
  );
}


