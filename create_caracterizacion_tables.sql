-- Script SQL para crear las tablas de caracterización de materiales
-- Ejecutar este script directamente en Supabase SQL Editor

-- Crear tablas para caracterización de materiales

-- Tabla principal para estudios de caracterización
CREATE TABLE IF NOT EXISTS public.alta_estudio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_planta UUID REFERENCES public.plants(id),
    planta VARCHAR(100) NOT NULL,
    tipo_material VARCHAR(50) NOT NULL CHECK (tipo_material IN ('Arena', 'Grava')),
    nombre_material VARCHAR(200) NOT NULL,
    mina_procedencia VARCHAR(200) NOT NULL,
    ubicacion VARCHAR(200) NOT NULL,
    tamaño VARCHAR(50),
    origen_material VARCHAR(100),
    tecnico VARCHAR(100) NOT NULL,
    id_muestra VARCHAR(100) NOT NULL UNIQUE,
    tipo_estudio TEXT[] NOT NULL, -- Array de tipos de estudio
    fecha_muestreo DATE NOT NULL,
    fecha_elaboracion DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Tabla para estudios seleccionados/programados
CREATE TABLE IF NOT EXISTS public.estudios_seleccionados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alta_estudio_id UUID REFERENCES public.alta_estudio(id) ON DELETE CASCADE NOT NULL,
    tipo_estudio VARCHAR(100) NOT NULL,
    nombre_estudio VARCHAR(100) NOT NULL,
    descripcion TEXT,
    norma_referencia VARCHAR(100),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' 
        CHECK (estado IN ('pendiente', 'en_proceso', 'completado')),
    fecha_programada DATE NOT NULL,
    fecha_completado DATE,
    resultados JSONB, -- Almacenar resultados de los análisis
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_alta_estudio_planta ON public.alta_estudio(id_planta);
CREATE INDEX IF NOT EXISTS idx_alta_estudio_tipo_material ON public.alta_estudio(tipo_material);
CREATE INDEX IF NOT EXISTS idx_alta_estudio_fecha_muestreo ON public.alta_estudio(fecha_muestreo);
CREATE INDEX IF NOT EXISTS idx_alta_estudio_id_muestra ON public.alta_estudio(id_muestra);

CREATE INDEX IF NOT EXISTS idx_estudios_seleccionados_alta_estudio ON public.estudios_seleccionados(alta_estudio_id);
CREATE INDEX IF NOT EXISTS idx_estudios_seleccionados_estado ON public.estudios_seleccionados(estado);
CREATE INDEX IF NOT EXISTS idx_estudios_seleccionados_fecha_programada ON public.estudios_seleccionados(fecha_programada);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_alta_estudio_updated_at 
    BEFORE UPDATE ON public.alta_estudio 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estudios_seleccionados_updated_at 
    BEFORE UPDATE ON public.estudios_seleccionados 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS (Row Level Security)
ALTER TABLE public.alta_estudio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudios_seleccionados ENABLE ROW LEVEL SECURITY;

-- Política para alta_estudio: Solo QUALITY_TEAM y EXECUTIVE pueden acceder
CREATE POLICY "Users can view alta_estudio based on role" ON public.alta_estudio
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can insert alta_estudio based on role" ON public.alta_estudio
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can update alta_estudio based on role" ON public.alta_estudio
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can delete alta_estudio based on role" ON public.alta_estudio
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

-- Política para estudios_seleccionados: Solo QUALITY_TEAM y EXECUTIVE pueden acceder
CREATE POLICY "Users can view estudios_seleccionados based on role" ON public.estudios_seleccionados
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can insert estudios_seleccionados based on role" ON public.estudios_seleccionados
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can update estudios_seleccionados based on role" ON public.estudios_seleccionados
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can delete estudios_seleccionados based on role" ON public.estudios_seleccionados
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

-- Comentarios para documentación
COMMENT ON TABLE public.alta_estudio IS 'Tabla principal para estudios de caracterización de materiales (agregados)';
COMMENT ON TABLE public.estudios_seleccionados IS 'Tabla para estudios específicos programados dentro de cada caracterización';

COMMENT ON COLUMN public.alta_estudio.tipo_estudio IS 'Array de tipos de análisis: Caracterización interna, Validación, Nuevo prospecto';
COMMENT ON COLUMN public.estudios_seleccionados.resultados IS 'Resultados de los análisis en formato JSON específico por tipo de estudio';
COMMENT ON COLUMN public.estudios_seleccionados.estado IS 'Estado del estudio: pendiente, en_proceso, completado';

-- Verificar que las tablas se crearon correctamente
SELECT 'Tabla alta_estudio creada correctamente' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alta_estudio');

SELECT 'Tabla estudios_seleccionados creada correctamente' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estudios_seleccionados');
