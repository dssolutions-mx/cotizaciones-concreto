-- Performance optimization indexes for order and remision queries
-- These indexes will significantly speed up the calendar and sales dashboard loading

-- Orders table indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_orders_status_plant_date ON orders(order_status, plant_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_credit_status_plant ON orders(credit_status, plant_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date_plant ON orders(delivery_date, plant_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_plant ON orders(client_id, plant_id);

-- Remisiones table indexes for date filtering and joins
CREATE INDEX IF NOT EXISTS idx_remisiones_fecha_plant ON remisiones(fecha, plant_id);
CREATE INDEX IF NOT EXISTS idx_remisiones_order_fecha ON remisiones(order_id, fecha);
CREATE INDEX IF NOT EXISTS idx_remisiones_tipo_fecha ON remisiones(tipo_remision, fecha);

-- Order items indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_type);
CREATE INDEX IF NOT EXISTS idx_order_items_pump_service ON order_items(has_pump_service) WHERE has_pump_service = true;

-- Composite index for complex remisiones queries
CREATE INDEX IF NOT EXISTS idx_remisiones_composite ON remisiones(plant_id, fecha, tipo_remision, order_id);

-- Index for client balance calculations
CREATE INDEX IF NOT EXISTS idx_orders_balance_calc ON orders(order_status, plant_id) WHERE order_status != 'cancelled';

-- Index for credit validation queries
CREATE INDEX IF NOT EXISTS idx_orders_credit_pending ON orders(credit_status, created_at) WHERE credit_status = 'pending';

COMMENT ON INDEX idx_orders_status_plant_date IS 'Optimizes calendar view filtering by status, plant and date';
COMMENT ON INDEX idx_remisiones_fecha_plant IS 'Optimizes remisiones date filtering with plant access control';
COMMENT ON INDEX idx_remisiones_composite IS 'Optimizes complex remisiones queries with multiple filters';
