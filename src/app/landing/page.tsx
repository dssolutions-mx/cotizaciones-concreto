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
  ChevronRight,
  Building2,
  Shield,
  Truck,
  Calculator,
  TrendingUp,
  Database,
  Settings,
  Bell,
  Headphones,
  BadgeCheck,
  Receipt
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
          <div className="absolute inset-0 bg-linear-to-r from-gray-900/80 to-gray-900/60 z-10" />
          <Image 
            src="/images/dcconcretos/hero1.jpg"
            alt="DC Concretos - Sistema Integral de Gestión de Plantas de Concreto" 
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Logo */}
        <div className="absolute top-6 left-6 z-20">
          <div className="">
            <Image 
              src="/images/dcconcretos/logo.svg" 
              alt="DC Concretos Logo" 
              width={160} 
              height={50} 
              className="drop-shadow-md"
            />
          </div>
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-6 relative z-20 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
              Portal de Clientes: Transparencia, Calidad y Finanzas Claras
            </h1>
            <p className="text-xl mb-8 drop-shadow-sm text-gray-100">
              Consulta el estado de tus pedidos en tiempo real, verifica la calidad con evidencias y controla tu saldo y pagos desde un mismo lugar.
            </p>
            <div className="flex justify-left">
              <a href="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-md transition-all duration-300 shadow-lg"
                >
                  Entrar al Portal
                </motion.button>
              </a>
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[{
                icon: <BadgeCheck className="w-5 h-5" />, title: 'Transparencia en cada pedido'
              },{
                icon: <Shield className="w-5 h-5" />, title: 'Laboratorio y control de calidad'
              },{
                icon: <BarChart3 className="w-5 h-5" />, title: 'Estado de cuenta en tiempo real'
              },{
                icon: <Headphones className="w-5 h-5" />, title: 'Soporte dedicado'
              }].map((badge, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/10 rounded-md px-4 py-2 backdrop-blur-sm">
                  <div className="text-green-300">
                    {badge.icon}
                  </div>
                  <span className="text-sm text-gray-100">{badge.title}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pilares principales */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{
              icon: <Search className="w-7 h-7" />, title: 'Transparencia total', desc: 'Seguimiento de pedidos, remisiones y evidencias de entrega en un clic.'
            },{
              icon: <Shield className="w-7 h-7" />, title: 'Calidad comprobable', desc: 'Resultados de ensayos, muestreos y certificados disponibles para tus obras.'
            },{
              icon: <DollarSign className="w-7 h-7" />, title: 'Finanzas claras', desc: 'Saldo al día, pagos registrados y documentos disponibles cuando los necesites.'
            }].map((item, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-6 flex items-start gap-4">
                <div className="text-green-600 bg-green-100 rounded-lg w-12 h-12 flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{item.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Módulos Principales */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-800">
            Portal del Cliente: ¿Qué puedes hacer?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                title: 'Estado de pedidos en tiempo real', 
                description: 'Sigue tus entregas, horarios y remisiones desde cualquier dispositivo',
                icon: <Truck className="w-8 h-8" />,
                href: '/orders',
                color: 'bg-blue-50 text-blue-600',
                features: ['Seguimiento de entrega', 'Remisiones asociadas', 'Historial por obra']
              },
              { 
                title: 'Calidad y certificados', 
                description: 'Consulta ensayos, muestreos y certificados de tus colados',
                icon: <FileCheck className="w-8 h-8" />,
                href: '/quality',
                color: 'bg-green-50 text-green-600',
                features: ['Ensayos y resultados', 'Certificados por pedido', 'Alertas de calidad']
              },
              { 
                title: 'Saldo y pagos', 
                description: 'Revisa tu saldo, descarga estados de cuenta y registra pagos',
                icon: <DollarSign className="w-8 h-8" />,
                href: '/finanzas',
                color: 'bg-purple-50 text-purple-600',
                features: ['Saldo actualizado', 'Historial de pagos', 'Descarga de documentos']
              },
              { 
                title: 'Remisiones y documentos', 
                description: 'Descarga remisiones, facturas y documentación de tus obras',
                icon: <Receipt className="w-8 h-8" />,
                href: '/finanzas',
                color: 'bg-orange-50 text-orange-600',
                features: ['Remisiones por obra', 'Facturas y CFDI', 'Comprobantes disponibles']
              },
              { 
                title: 'Notificaciones y alertas', 
                description: 'Recibe avisos de programación, cambios y resultados de calidad',
                icon: <Bell className="w-8 h-8" />,
                href: '/dashboard',
                color: 'bg-indigo-50 text-indigo-600',
                features: ['Alertas de entrega', 'Cambios de horario', 'Resultados de laboratorio']
              },
              { 
                title: 'Soporte y comunicación', 
                description: 'Habla con nuestro equipo comercial y de calidad cuando lo necesites',
                icon: <Headphones className="w-8 h-8" />,
                href: '/contact',
                color: 'bg-red-50 text-red-600',
                features: ['Chat y correo', 'Atención a obra', 'Acompañamiento técnico']
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.1)' }}
                className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 h-full border border-gray-100 cursor-pointer"
              >
                <div className={`mb-5 p-4 rounded-full ${item.color} inline-block`}>{item.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-gray-800">{item.title}</h3>
                <p className="text-gray-600 mb-4">{item.description}</p>
                <ul className="space-y-2 mb-6">
                  {item.features.map((feature, fIndex) => (
                    <li key={fIndex} className="text-sm text-gray-500 flex items-center">
                      <CheckSquare className="w-4 h-4 mr-2 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a href={item.href} className="text-green-600 hover:text-green-700 font-medium inline-flex items-center">
                  Explorar <ChevronRight className="w-4 h-4 ml-1" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Características Avanzadas */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-800">
            Características Avanzadas
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-6 text-gray-800">
                Tecnología de Vanguardia
              </h3>
              <div className="space-y-6">
                {[
                  {
                    icon: <Database className="w-6 h-6" />,
                    title: 'Base de Datos Integrada',
                    description: 'Sistema unificado que conecta todos los módulos para una gestión coherente'
                  },
                  {
                    icon: <Calculator className="w-6 h-6" />,
                    title: 'Calculadora de Mezclas',
                    description: 'Herramienta avanzada para el diseño y cálculo de fórmulas de concreto'
                  },
                  {
                    icon: <TrendingUp className="w-6 h-6" />,
                    title: 'Métricas en Tiempo Real',
                    description: 'Dashboard con indicadores clave de rendimiento actualizados constantemente'
                  },
                  {
                    icon: <Settings className="w-6 h-6" />,
                    title: 'Configuración Multiplanta',
                    description: 'Soporte para múltiples plantas con configuraciones independientes'
                  }
                ].map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">{feature.title}</h4>
                      <p className="text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <Image 
                src="/images/dcconcretos/hero2.jpeg?v=1" 
                alt="Sistema de Gestión DC Concretos" 
                width={600} 
                height={400} 
                className="rounded-lg shadow-xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-gray-700">Sistema Activo</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">24/7 Monitoreo</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios del Sistema */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-800">
            Beneficios del Sistema Integral
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Truck className="w-8 h-8" />,
                title: 'Eficiencia Operativa',
                description: 'Reduce tiempos de proceso y optimiza la producción'
              },
              {
                icon: <DollarSign className="w-8 h-8" />,
                title: 'Control Financiero',
                description: 'Mantén el control total de tus finanzas y créditos'
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: 'Calidad Garantizada',
                description: 'Asegura la calidad del concreto con controles rigurosos'
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: 'Toma de Decisiones',
                description: 'Información en tiempo real para decisiones estratégicas'
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="bg-white p-6 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center text-green-600 shadow-md">
                  {benefit.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gray-900/80 z-10" />
          <Image 
            src="/images/dcconcretos/hero1.jpg?v=1" 
            alt="DC Concretos - Bienvenido al Sistema" 
            fill
            className="object-cover"
          />
        </div>
        <div className="container mx-auto px-6 relative z-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6 text-white">
              Transparencia y control para tus obras
            </h2>
            <p className="text-gray-200 mb-10 text-lg">
              Ingresa al portal para ver tus pedidos, calidad y estado de cuenta en tiempo real.
            </p>
            <div className="flex justify-center">
              <a href="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-md transition-all duration-300 shadow-lg"
                >
                  Entrar al Portal
                </motion.button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-8 md:mb-0">
              <div className="">
                <Image 
                  src="/images/dcconcretos/logo.svg" 
                  alt="DC Concretos Logo" 
                  width={120} 
                  height={40} 
                  className="brightness-150"
                />
              </div>
              <p className="mt-3 text-gray-400 text-sm">
                Sistema Integral de Gestión para Plantas de Concreto
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
              <div>
                <h4 className="font-bold mb-3 text-gray-300">Módulos Principales</h4>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/finanzas" className="hover:text-white transition-colors">Finanzas</Link></li>
                  <li><Link href="/quality" className="hover:text-white transition-colors">Calidad</Link></li>
                  <li><Link href="/recipes" className="hover:text-white transition-colors">Recetas</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-gray-300">Acceso</h4>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/login" className="hover:text-white transition-colors">Iniciar Sesión</Link></li>
                  <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                  <li><Link href="/clients" className="hover:text-white transition-colors">Clientes</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-3 text-gray-300">Empresa</h4>
                <ul className="space-y-2 text-gray-400">
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contacto</Link></li>
                  <li><Link href="/help" className="hover:text-white transition-colors">Soporte</Link></li>
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