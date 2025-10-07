export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="py-16">
        <div className="container mx-auto px-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Contacto</h1>
          <p className="text-gray-600 max-w-2xl">
            Para soporte o preguntas comerciales, contáctanos en
            <a href="mailto:soporte@dcconcretos.com.mx" className="text-green-600 hover:text-green-700 ml-1">soporte@dcconcretos.com.mx</a>
            , o llama al <span className="font-medium">+52 (xxx) xxx xxxx</span>.
          </p>
        </div>
      </section>
    </div>
  );
}


