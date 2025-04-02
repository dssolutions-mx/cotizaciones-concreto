'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Users, 
  ClipboardList, 
  BarChart3, 
  User, 
  DollarSign, 
  CheckSquare, 
  FileCheck, 
  Search,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  // Verificar si estamos en el cliente para evitar errores de hidratación
  useEffect(() => {
    // Solo ejecuta código específico del cliente después de que el componente se monte
    console.log('Landing page mounted');
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 to-gray-900/60 z-10" />
          <Image 
            src="/images/dcconcretos/hero1.jpg?v=1"
            alt="DC Concretos - Obra de construcción con concreto" 
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Logo */}
        <div className="absolute top-6 left-6 z-20">
          <Image 
            src="/images/dcconcretos/logo.svg" 
            alt="DC Concretos Logo" 
            width={180} 
            height={60} 
            className="drop-shadow-lg"
          />
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-6 relative z-20 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
              Cotizaciones precisas de concreto en minutos, no en días
            </h1>
            <p className="text-xl mb-8 drop-shadow text-gray-100">
              Simplifica tus procesos de cotización con nuestro sistema especializado para la industria del concreto
            </p>
            <a href="/login">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-md transition-all duration-300 shadow-lg"
              >
                Abrir Cotizador
              </motion.button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Panel de Acceso Rápido */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            Acceso Rápido
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { 
                title: 'Nueva Cotización', 
                description: 'Inicia el proceso de cotización de manera rápida',
                icon: <FileText className="w-8 h-8" />,
                href: '/login',
                color: 'bg-green-50 text-green-600'
              },
              { 
                title: 'Gestión de Clientes', 
                description: 'Administra la información de tus clientes',
                icon: <Users className="w-8 h-8" />,
                href: '/login',
                color: 'bg-green-50 text-green-600'
              },
              { 
                title: 'Recetas', 
                description: 'Administra tus recetas y fórmulas de concreto',
                icon: <ClipboardList className="w-8 h-8" />,
                href: '/login',
                color: 'bg-green-50 text-green-600'
              },
              { 
                title: 'Historial de Precios', 
                description: 'Consulta el histórico de precios y cotizaciones',
                icon: <BarChart3 className="w-8 h-8" />,
                href: '/login',
                color: 'bg-green-50 text-green-600'
              }
            ].map((item, index) => (
              <a key={index} href={item.href}>
                <motion.div
                  whileHover={{ y: -10, boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.1)' }}
                  className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 h-full border border-gray-100 cursor-pointer"
                >
                  <div className={`mb-5 p-4 rounded-full ${item.color} inline-block`}>{item.icon}</div>
                  <h3 className="text-xl font-bold mb-3 text-gray-800">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </motion.div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Explicación Visual del Sistema */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-800">
            Cómo Funciona
          </h2>
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-12 lg:space-y-0 lg:space-x-4">
            {[
              {
                step: 1,
                title: 'Selección de cliente',
                description: 'Elige o registra el cliente para la cotización',
                icon: <User className="w-8 h-8" />,
                color: 'bg-green-50 text-green-600'
              },
              {
                step: 2,
                title: 'Selección de receta',
                description: 'Elige la receta de concreto adecuada',
                icon: <ClipboardList className="w-8 h-8" />,
                color: 'bg-green-50 text-green-600'
              },
              {
                step: 3,
                title: 'Configuración de precio',
                description: 'Ajusta precios según volúmenes y condiciones',
                icon: <DollarSign className="w-8 h-8" />,
                color: 'bg-green-50 text-green-600'
              },
              {
                step: 4,
                title: 'Proceso de aprobación',
                description: 'Envía para revisión y aprobación',
                icon: <CheckSquare className="w-8 h-8" />,
                color: 'bg-green-50 text-green-600'
              },
              {
                step: 5,
                title: 'Cotización finalizada',
                description: 'Genera el documento final para el cliente',
                icon: <FileCheck className="w-8 h-8" />,
                color: 'bg-green-50 text-green-600'
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
                className="flex flex-col items-center text-center w-full lg:w-1/5"
              >
                <div className={`mb-5 p-5 rounded-full ${step.color} shadow-md`}>
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-800">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
                {index < 4 && (
                  <div className="hidden lg:block mt-6 text-green-500 text-2xl">
                    <ChevronRight className="h-8 w-8" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Búsqueda Centralizada con Imagen de Fondo */}
      <section className="py-20 relative">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gray-900/80 z-10" />
          <Image 
            src="/images/dcconcretos/hero2.jpg?v=1" 
            alt="DC Concretos - Concreto" 
            fill
            className="object-cover"
          />
        </div>
        <div className="container mx-auto px-6 relative z-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6 text-white">
              Búsqueda Centralizada
            </h2>
            <p className="text-gray-200 mb-10 text-lg">
              Encuentra rápidamente lo que necesitas en un solo lugar
            </p>
            <form action="/dashboard" method="get">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-white p-4 rounded-lg shadow-lg flex items-center border border-gray-100"
              >
                <input
                  type="text"
                  name="search"
                  placeholder="Buscar clientes, cotizaciones o recetas..."
                  className="flex-1 py-3 px-5 outline-none text-gray-700"
                />
                <button 
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-md ml-2 transition-colors duration-300 shadow-md flex items-center"
                >
                  <Search className="w-5 h-5 mr-2" />
                  Buscar
                </button>
              </motion.div>
            </form>
            <div className="mt-5 text-sm text-gray-200 flex flex-wrap justify-center gap-3">
              <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">Cliente ABC</span>
              <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">Cotización #123</span>
              <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">Receta Concreto 300</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-8 md:mb-0">
              <Image 
                src="/images/dcconcretos/logo.svg" 
                alt="DC Concretos Logo" 
                width={140} 
                height={45} 
                className="brightness-125"
              />
              <p className="mt-3 text-gray-400 text-sm">
                Soluciones precisas para la industria del concreto
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
              <div>
                <h4 className="font-bold mb-3 text-gray-300">Enlaces Rápidos</h4>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/login" className="hover:text-white transition-colors">Iniciar Sesión</Link></li>
                  <li><Link href="/quotes" className="hover:text-white transition-colors">Cotizaciones</Link></li>
                  <li><Link href="/clients" className="hover:text-white transition-colors">Clientes</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-gray-300">Recursos</h4>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/help" className="hover:text-white transition-colors">Centro de Ayuda</Link></li>
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contacto</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-gray-300">Legal</h4>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/terms" className="hover:text-white transition-colors">Términos de Uso</Link></li>
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacidad</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-10 pt-8 text-center md:flex md:justify-between md:items-center">
            <p className="text-gray-400 text-sm">&copy; {new Date().getFullYear()} DC Concretos. Todos los derechos reservados.</p>
            <p className="text-gray-400 text-sm mt-2 md:mt-0">
              <a href="http://dcconcretos.com.mx" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                dcconcretos.com.mx
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
} 