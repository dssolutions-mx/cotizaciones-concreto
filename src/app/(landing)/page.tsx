'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/50 z-10" />
          <Image 
            src="/images/concrete-construction.jpg" 
            alt="Obra de construcción con concreto" 
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Logo */}
        <div className="absolute top-4 md:top-6 left-4 md:left-6 z-20">
          <Image 
            src="/images/dc-concretos-logo.png" 
            alt="DC Concretos Logo" 
            width={120} 
            height={40} 
            className="w-auto h-8 md:h-10"
          />
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-4 md:px-6 relative z-20 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4">
              Cotizaciones precisas de concreto en minutos, no en días
            </h1>
            <p className="text-lg md:text-xl mb-6 md:mb-8">
              Simplifica tus procesos de cotización con nuestro sistema especializado para la industria del concreto
            </p>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-green-500 hover:bg-green-600 text-white py-2 md:py-3 px-6 md:px-8 rounded-lg text-lg font-medium shadow-lg"
              >
                Abrir Cotizador
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12 text-gray-800">
            Características Principales
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                title: 'Gestión de Recetas',
                description: 'Administra fácilmente tus recetas de concreto con todos los componentes y características.',
                icon: '🧪',
                link: '/login'
              },
              {
                title: 'Precios Actualizados',
                description: 'Mantén los precios de materiales siempre actualizados para cotizaciones precisas.',
                icon: '💹',
                link: '/login'
              },
              {
                title: 'Historial de Precios',
                description: 'Accede al historial completo de cambios de precios para análisis y comparativas.',
                icon: '📊',
                link: '/login'
              },
              {
                title: 'Cotizaciones Rápidas',
                description: 'Genera cotizaciones en minutos con cálculos automáticos basados en volumen y distancia.',
                icon: '⚡',
                link: '/login'
              },
              {
                title: 'Gestión de Clientes',
                description: 'Administra tu cartera de clientes con información detallada y personalizada.',
                icon: '👥',
                link: '/login'
              },
              {
                title: 'Reportes y Estadísticas',
                description: 'Obtén reportes detallados y visualizaciones para tomar mejores decisiones comerciales.',
                icon: '📈',
                link: '/dashboard'
              }
            ].map((item, index) => (
              <Link href={item.link} key={index}>
                <motion.div
                  whileHover={{ y: -5 }}
                  className="bg-white p-6 rounded-lg shadow-md h-full cursor-pointer"
                >
                  <div className="text-3xl md:text-4xl mb-3 md:mb-4">{item.icon}</div>
                  <h3 className="text-lg md:text-xl font-bold mb-2 text-gray-800">{item.title}</h3>
                  <p className="text-sm md:text-base text-gray-600">{item.description}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Explicación Visual del Sistema */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12 text-gray-800">
            Cómo Funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-4">
            {[
              {
                step: 1,
                title: 'Selección de cliente',
                description: 'Elige o registra el cliente para la cotización',
                icon: '👤'
              },
              {
                step: 2,
                title: 'Selección de receta',
                description: 'Elige la receta de concreto adecuada',
                icon: '📋'
              },
              {
                step: 3,
                title: 'Configuración de precio',
                description: 'Ajusta precios según volúmenes y condiciones',
                icon: '💰'
              },
              {
                step: 4,
                title: 'Proceso de aprobación',
                description: 'Envía para revisión y aprobación',
                icon: '✅'
              },
              {
                step: 5,
                title: 'Cotización finalizada',
                description: 'Genera el documento final para el cliente',
                icon: '📄'
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center text-center p-4"
              >
                <div className="bg-green-500 text-white w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-2xl mb-4">
                  {step.icon}
                </div>
                <div className="bg-green-100 text-green-800 text-sm font-bold px-2 py-1 rounded-full mb-2">
                  Paso {step.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-sm md:text-base text-gray-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12 text-gray-800">
            Lo Que Dicen Nuestros Clientes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                name: 'Carlos Rodríguez',
                position: 'Director de Operaciones',
                company: 'Constructora XYZ',
                testimonial: 'Este sistema ha transformado completamente nuestro proceso de cotización. Ahora generamos presupuestos precisos en minutos.',
              },
              {
                name: 'María González',
                position: 'Gerente de Ventas',
                company: 'Concretos Modernos',
                testimonial: 'La facilidad de uso y la precisión en los cálculos nos ha permitido mejorar nuestras tasas de conversión y satisfacción del cliente.',
              },
              {
                name: 'Juan Pérez',
                position: 'Dueño',
                company: 'Constructora Pérez',
                testimonial: 'Como pequeña empresa, este sistema nos ha permitido competir con grandes concreteras gracias a la rapidez y profesionalismo en nuestras cotizaciones.',
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 rounded-lg shadow-md h-full"
              >
                <div className="flex flex-col h-full">
                  <div className="grow">
                    <p className="text-gray-700 mb-4 text-sm md:text-base">&ldquo;{testimonial.testimonial}&rdquo;</p>
                  </div>
                  <div>
                    <p className="font-semibold text-base md:text-lg">{testimonial.name}</p>
                    <p className="text-gray-600 text-sm">{testimonial.position}, {testimonial.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-12 md:py-16 bg-green-500 text-white">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">¿Listo para optimizar tu proceso de cotización?</h2>
          <p className="text-lg md:text-xl mb-8">Comienza hoy mismo a ahorrar tiempo y mejorar la precisión de tus cotizaciones</p>
          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-green-600 py-2 md:py-3 px-6 md:px-8 rounded-lg text-lg font-medium shadow-lg"
            >
              Comenzar Ahora
            </motion.button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 md:py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <Image 
                src="/images/dc-concretos-logo.png" 
                alt="DC Concretos Logo" 
                width={120} 
                height={40}
                className="w-auto h-8 md:h-10" 
              />
            </div>
            <div className="text-center md:text-right text-sm md:text-base">
              <p>&copy; {new Date().getFullYear()} DC Concretos. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 