# Changes to Support Client-Specific Pricing Per Construction Site

## Overview

Previously, the system was setting active prices based on client and recipe combinations. The updated logic now sets active prices based on client, recipe, AND construction site combinations. This allows for more granular pricing control where the same client can have different prices for the same product at different construction sites.

## Changes Made

1. **Database Schema**:
   - Added `construction_site` column to the `product_prices` table
   - Created an index on `client_id`, `recipe_id`, and `construction_site` for faster lookups

2. **Product Prices Service**:
   - Updated `ProductPriceData` interface to include `construction_site` field
   - Modified `deactivateExistingPrices` function to consider construction site
   - Updated `handleQuoteApproval` function to include construction site data from the quote
   - Enhanced `createNewPrice` function to log and store construction site information

3. **Price Service**:
   - Updated `saveProductPrice` function to include optional `constructionSite` and `clientId` parameters
   - Modified `getActiveProducts` function to allow filtering by client ID and construction site

4. **Quotes Service**:
   - Fixed linter errors by adding the `Client` interface
   - Updated data handling to properly handle null cases
   - Implemented direct calculations for final price and total amount

## How It Works Now

1. When a quote is approved, the system deactivates existing prices for the specific client-recipe-construction site combination.
2. New price records are created with the construction site information included.
3. When retrieving active products, you can now filter by both client ID and construction site.
4. The product description now includes the construction site information for better identification.

## Migration Steps

1. Run the database migration:
   - `add_construction_site_to_product_prices.sql`
2. Deploy the updated code to your environment
3. Restart the application to ensure all changes take effect

## Testing

After implementing these changes, you should test:
1. Creating and approving quotes with construction site information
2. Verifying that prices are correctly associated with the construction site
3. Retrieving prices filtered by construction site
4. Ensuring that the same client can have different prices for the same product at different construction sites

## Implementación del Sistema de Gestión de Pedidos (2024-06-04)

Se ha implementado un sistema completo de gestión de pedidos con las siguientes características:

### Nuevas Tablas

- `orders`: Tabla principal para almacenar pedidos de clientes
- `order_items`: Detalle de productos en cada pedido
- `order_notifications`: Registro de notificaciones enviadas relacionadas con pedidos

### Nuevas Funciones SQL

- `generate_order_number()`: Genera números de pedido únicos con formato año-número secuencial
- `create_order_from_quote()`: Crea un pedido a partir de una cotización aprobada
- `create_order_with_details()`: Crea un pedido con opciones adicionales como vacío de olla
- `approve_order_credit()`: Función para aprobar el crédito de un pedido
- `reject_order_credit()`: Función para rechazar el crédito de un pedido

### Edge Functions de Supabase

- `credit-validation-notification`: Envía correos para validación de crédito usando SendGrid
- `daily-schedule-report`: Envía reporte diario de entregas programadas

### Políticas de Seguridad (RLS)

Se han implementado políticas de Row Level Security (RLS) para:

- Permitir lectura de pedidos a todos los usuarios autenticados
- Restringir la creación de pedidos a roles específicos
- Restringir la validación de crédito a ejecutivos y gerentes de planta

Archivos relacionados:
- `migrations/orders_tables.sql`: Definición de tablas y funciones
- `migrations/supabase/functions/credit-validation-notification`: Edge function para notificaciones de validación
- `migrations/supabase/functions/daily-schedule-report`: Edge function para reporte diario
- `src/lib/supabase/orders.ts`: Cliente Supabase para gestión de pedidos
- `src/types/orders.ts`: Tipos TypeScript para pedidos
- `migrations/supabase/DEPLOYMENT.md`: Instrucciones de despliegue

## Changes in this directory

This directory contains migration scripts for the database.

### Orders table update

Added tables and functions for order management:

- `orders` - Orders table
- `order_items` - Order items table
- `order_notifications` - Order notifications table

Added functions:
- `generate_order_number` - Generates a unique order number
- `create_order_from_quote` - Creates an order from a quote
- `create_order_with_details` - Creates an order with details
- `approve_order_credit` - Approves credit for an order
- `reject_order_credit` - Rejects credit for an order

### New Roles and Credit Validation Flow Update (Apr 2024)

- Added new roles: `CREDIT_VALIDATOR` and `DOSIFICADOR`
- Added new credit status: `rejected_by_validator`
- Added new policies for the new roles
- Updated credit validation workflow to include validation by credit validators
- Updated notification system to notify appropriate users based on credit status changes

The changes are included in the `new_roles_and_credit_validation.sql` script. 