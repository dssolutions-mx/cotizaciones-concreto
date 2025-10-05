-- Crear tabla para límites granulométricos según tipo y tamaño de material
CREATE TABLE IF NOT EXISTS public.limites_granulometricos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_material VARCHAR(10) NOT NULL CHECK (tipo_material IN ('Arena', 'Grava')),
    tamaño VARCHAR(50) NOT NULL, -- Ej: '10mm', '13mm', '20mm', '25mm', '40-20mm', '40-4mm', etc.
    descripcion VARCHAR(200),
    mallas JSONB NOT NULL, -- Array de objetos con: { malla: string, limite_inferior: number, limite_superior: number }
    norma_referencia VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tipo_material, tamaño)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_limites_granulometricos_tipo ON public.limites_granulometricos(tipo_material);
CREATE INDEX IF NOT EXISTS idx_limites_granulometricos_tamaño ON public.limites_granulometricos(tamaño);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_limites_granulometricos_updated_at 
    BEFORE UPDATE ON public.limites_granulometricos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.limites_granulometricos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Solo QUALITY_TEAM y EXECUTIVE pueden ver y gestionar
CREATE POLICY "Users can view limites_granulometricos based on role" ON public.limites_granulometricos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can insert limites_granulometricos based on role" ON public.limites_granulometricos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

CREATE POLICY "Users can update limites_granulometricos based on role" ON public.limites_granulometricos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('QUALITY_TEAM', 'EXECUTIVE')
        )
    );

-- Poblar tabla con datos de límites de gravas según la imagen proporcionada
-- Gráfica Grava 10 mm
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '10mm', 'Gráfica Grava 10 mm', 
'[
  {"malla": "1 1/2", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "3/3", "limite_inferior": 85, "limite_superior": 100},
  {"malla": "4", "limite_inferior": 10, "limite_superior": 30},
  {"malla": "8", "limite_inferior": 0, "limite_superior": 10},
  {"malla": "16", "limite_inferior": 0, "limite_superior": 5}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Gráfica Grava 13 mm
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '13mm', 'Gráfica Grava 13 mm',
'[
  {"malla": "3/4", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "1/2", "limite_inferior": 90, "limite_superior": 100},
  {"malla": "3/8", "limite_inferior": 40, "limite_superior": 70},
  {"malla": "4", "limite_inferior": 0, "limite_superior": 15},
  {"malla": "8", "limite_inferior": 0, "limite_superior": 5}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Gráfica Grava 20 mm
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '20mm', 'Gráfica Grava 20 mm',
'[
  {"malla": "1", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "3/4", "limite_inferior": 90, "limite_superior": 100},
  {"malla": "3/8", "limite_inferior": 20, "limite_superior": 55},
  {"malla": "4", "limite_inferior": 0, "limite_superior": 10},
  {"malla": "8", "limite_inferior": 0, "limite_superior": 5}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Gráfica Grava 25 mm
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '25mm', 'Gráfica Grava 25 mm',
'[
  {"malla": "1 1/2", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "1", "limite_inferior": 95, "limite_superior": 100},
  {"malla": "1/2", "limite_inferior": 25, "limite_superior": 60},
  {"malla": "4", "limite_inferior": 0, "limite_superior": 10},
  {"malla": "8", "limite_inferior": 0, "limite_superior": 5}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Gráfica Grava 40-20 mm
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '40-20mm', 'Gráfica Grava 40-20 mm',
'[
  {"malla": "2", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "1 1/2", "limite_inferior": 90, "limite_superior": 100},
  {"malla": "1", "limite_inferior": 20, "limite_superior": 55},
  {"malla": "3/4", "limite_inferior": 0, "limite_superior": 15},
  {"malla": "3/8", "limite_inferior": 0, "limite_superior": 5}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Gráfica Grava 40-4 mm
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '40-4mm', 'Gráfica Grava 40-4 mm',
'[
  {"malla": "2", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "1 1/2", "limite_inferior": 95, "limite_superior": 100},
  {"malla": "3/4", "limite_inferior": 35, "limite_superior": 70},
  {"malla": "3/8", "limite_inferior": 10, "limite_superior": 30},
  {"malla": "4", "limite_inferior": 0, "limite_superior": 5}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Gráfica Grava 40-4 mm (1/2)
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '40-4mm (1/2)', 'Gráfica Grava 40-4 mm (1/2)',
'[
  {"malla": "2", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "1 1/2", "limite_inferior": 90, "limite_superior": 100},
  {"malla": "1", "limite_inferior": 20, "limite_superior": 55},
  {"malla": "3/4", "limite_inferior": 0, "limite_superior": 15},
  {"malla": "1/2", "limite_inferior": 0, "limite_superior": 10},
  {"malla": "3/8", "limite_inferior": 0, "limite_superior": 5},
  {"malla": "4", "limite_inferior": 0, "limite_superior": 0}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Gráfica Grava 20-8 mm
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) VALUES
('Grava', '20-8mm', 'Gráfica Grava 20-8 mm',
'[
  {"malla": "1", "limite_inferior": 100, "limite_superior": 100},
  {"malla": "3/4", "limite_inferior": 90, "limite_superior": 100},
  {"malla": "1/2", "limite_inferior": 40, "limite_superior": 70},
  {"malla": "3/8", "limite_inferior": 20, "limite_superior": 55},
  {"malla": "4", "limite_inferior": 0, "limite_superior": 10},
  {"malla": "8", "limite_inferior": 0, "limite_superior": 5}
]'::jsonb,
'ASTM C136 / NMX-C-077');

-- Comentarios para documentación
COMMENT ON TABLE public.limites_granulometricos IS 'Tabla que almacena los límites granulométricos inferior y superior para cada tipo y tamaño de material';
COMMENT ON COLUMN public.limites_granulometricos.mallas IS 'Array JSON con objetos que contienen: malla (nombre de la malla), limite_inferior (porcentaje), limite_superior (porcentaje)';


