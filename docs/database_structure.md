# Cotizador Database Structure Documentation

This document provides a comprehensive overview of the database structure, tables, functions, and triggers in the Cotizador project. It's designed to help developers understand the system and make changes without errors.

## Database Schema Overview

The database uses a PostgreSQL schema with several interconnected tables that manage clients, construction sites, quotes, orders, recipes, and more. The system is designed to handle concrete quotes and orders with a robust permission system through role-based access control (RBAC).

## Key Tables

### Clients and Construction Sites

- **clients**: Stores information about client companies
- **construction_sites**: Represents construction locations associated with clients

#### clients
Stores client information including business name, contact details, and credit status.
- Primary key: `id` (UUID)
- Notable columns:
  - `business_name`: Company name
  - `client_code`: Unique identifier code
  - `rfc`: Tax identification number
  - `requires_invoice`: Boolean indicating if invoices are required
  - `credit_status`: Client credit standing

#### construction_sites
Represents physical construction locations linked to clients.
- Primary key: `id` (UUID)
- Foreign key: `client_id` references `clients(id)`
- Notable columns:
  - `name`: Site name
  - `location`: Physical location
  - `access_restrictions`: Notes about access limitations
  - `special_conditions`: Any special requirements
  - `is_active`: Boolean indicating if site is currently active

### Quotes and Products

- **quotes**: Master records for client quotes
- **quote_details**: Line items in a quote
- **product_prices**: Product specifications and pricing
- **commercial_terms**: Terms associated with quotes

#### quotes
Master quote records containing quote metadata.
- Primary key: `id` (UUID)
- Foreign key: `client_id` references `clients(id)`
- Notable columns:
  - `quote_number`: Unique identifier
  - `construction_site`: Site name
  - `location`: Physical location
  - `status`: Quote status ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')
  - `validity_date`: Date until quote is valid
  - `created_by`: Reference to user who created the quote
  - `approved_by`: Reference to user who approved the quote

#### quote_details
Individual line items within a quote.
- Primary key: `id` (UUID)
- Foreign keys:
  - `quote_id` references `quotes(id)`
  - `product_id` references `product_prices(id)`
  - `recipe_id` references `recipes(id)`
- Notable columns:
  - `volume`: Concrete volume
  - `base_price`: Base product price
  - `profit_margin`: Profit percentage
  - `final_price`: Final price after margin
  - `pump_service`: Boolean indicating if pumping is required
  - `pump_price`: Price for pumping service
  - `total_amount`: Total price for line item

#### product_prices
Product catalog with pricing information.
- Primary key: `id` (UUID)
- Foreign keys:
  - `recipe_id` references `recipes(id)`
  - `client_id` references `clients(id)`
  - `original_recipe_id` references `recipes(id)`
  - `quote_id` references `quotes(id)`
- Notable columns:
  - `code`: Unique product code
  - `description`: Product description
  - `fc_mr_value`: Concrete strength value
  - `type`: Product type ('STANDARD', 'SPECIAL', 'QUOTED')
  - `age_days`: Curing days
  - `placement_type`: How concrete is placed
  - `max_aggregate_size`: Maximum aggregate size
  - `slump`: Concrete slump value
  - `base_price`: Standard product price
  - `construction_site`: Site-specific pricing

#### commercial_terms
Terms and conditions associated with quotes.
- Primary key: `id` (UUID)
- Foreign key: `quote_id` references `quotes(id)`
- Notable columns:
  - `term_type`: Type of term
  - `description`: Term description
  - `sort_order`: Display order
  - `is_active`: Boolean indicating if term is active

### Recipes and Materials

- **recipes**: Basic concrete recipe information
- **recipe_versions**: Versioned recipe implementations
- **material_quantities**: Materials needed for recipes
- **material_prices**: Pricing for materials
- **recipe_reference_materials**: Reference data for materials

#### recipes
Base concrete recipe definitions.
- Primary key: `id` (UUID)
- Notable columns:
  - `recipe_code`: Unique identifier
  - `strength_fc`: Concrete strength
  - `age_days`: Curing time
  - `placement_type`: How concrete is placed
  - `max_aggregate_size`: Maximum aggregate size
  - `slump`: Concrete slump value

#### recipe_versions
Historical versions of recipes with implementation details.
- Primary key: `id` (UUID)
- Foreign key: `recipe_id` references `recipes(id)`
- Notable columns:
  - `version_number`: Sequential version
  - `effective_date`: When version becomes active
  - `is_current`: Boolean indicating if this is the current version
  - `loaded_to_k2`: Boolean indicating if loaded to K2 system

#### material_quantities
Materials required for each recipe version.
- Primary key: `id` (UUID)
- Foreign key: `recipe_version_id` references `recipe_versions(id)`
- Notable columns:
  - `material_type`: Material identifier
  - `quantity`: Amount needed
  - `unit`: Unit of measurement

#### material_prices
Price history for materials.
- Primary key: `id` (UUID)
- Notable columns:
  - `material_type`: Material identifier
  - `price_per_unit`: Cost per unit
  - `effective_date`: When price becomes effective
  - `end_date`: When price expires

#### recipe_reference_materials
Reference data for Saturated Surface Dry (SSS) materials in recipes.
- Primary key: `id` (UUID)
- Foreign key: `recipe_version_id` references `recipe_versions(id)`
- Notable columns:
  - `material_type`: Material identifier
  - `sss_value`: Saturated Surface Dry value

### Orders and Fulfillment

- **orders**: Master order records
- **order_items**: Line items in an order
- **order_notifications**: Notifications related to orders
- **order_history**: Historical order data

#### orders
Master order records.
- Primary key: `id` (UUID)
- Foreign keys:
  - `quote_id` references `quotes(id)`
  - `client_id` references `clients(id)`
  - `created_by` references `auth.users(id)`
  - `credit_validated_by` references `auth.users(id)`
- Notable columns:
  - `order_number`: Unique identifier
  - `construction_site`: Site name
  - `requires_invoice`: Boolean indicating if invoice is needed
  - `delivery_date`: Scheduled delivery date
  - `delivery_time`: Scheduled delivery time
  - `special_requirements`: Special notes
  - `total_amount`: Total order value
  - `credit_status`: Status of credit approval ('pending', 'approved', 'rejected', 'rejected_by_validator')
  - `order_status`: Order fulfillment status
  - `rejection_reason`: Reason if rejected

#### order_items
Individual line items within an order.
- Primary key: `id` (UUID)
- Foreign keys:
  - `order_id` references `orders(id)`
  - `quote_detail_id` references `quote_details(id)`
- Notable columns:
  - `product_type`: Type of product
  - `volume`: Concrete volume
  - `unit_price`: Price per unit
  - `total_price`: Total price for item
  - `has_pump_service`: Boolean indicating if pumping is needed
  - `pump_price`: Cost of pumping
  - `pump_volume`: Volume for pumping (may differ from concrete volume)
  - `has_empty_truck_charge`: Boolean indicating if empty truck fee applies
  - `empty_truck_volume`: Volume for empty truck calculation
  - `empty_truck_price`: Empty truck fee

#### order_notifications
Notifications generated during order processing.
- Primary key: `id` (UUID)
- Foreign key: `order_id` references `orders(id)`
- Notable columns:
  - `notification_type`: Type of notification
  - `recipient`: Target recipient
  - `sent_at`: Timestamp when sent
  - `delivery_status`: Status of notification delivery

#### order_history
Historical record of orders (appears to be a legacy table).
- Primary key: `id` (UUID)
- Foreign key: `client_id` references `clients(id)`
- Notable columns:
  - Various order details similar to the orders table

### Users and Authentication

- **auth.users**: Built-in Supabase auth table
- **user_profiles**: Extended user information including roles

#### user_profiles
Extended user profile information with role-based access control.
- Primary key: `id` (UUID), references `auth.users(id)`
- Notable columns:
  - `email`: User email
  - `first_name`: User's first name
  - `last_name`: User's last name
  - `role`: User role, one of:
    - `QUALITY_TEAM`: Quality control personnel
    - `PLANT_MANAGER`: Plant management
    - `SALES_AGENT`: Sales personnel
    - `EXECUTIVE`: Company executives
    - `CREDIT_VALIDATOR`: Credit approval staff
    - `DOSIFICADOR`: Dosing/mixing personnel
  - `is_active`: Boolean indicating if user account is active

### Administrative Tables

- **additional_services**: Extra services that can be added
- **administrative_costs**: System-wide cost parameters

#### additional_services
Additional services that can be added to orders.
- Primary key: `id` (UUID)
- Notable columns:
  - `code`: Service identifier
  - `description`: Service description
  - `price`: Service cost
  - `is_active`: Boolean indicating if service is available

#### administrative_costs
System-wide costs used in calculations.
- Primary key: `id` (UUID)
- Notable columns:
  - `cost_type`: Type of cost
  - `description`: Cost description
  - `amount`: Cost value
  - `effective_date`: When cost becomes effective
  - `end_date`: When cost expires

## Database Functions

### Credit Management Functions

#### approve_order_credit(order_id UUID)
Approves credit for an order.
- Parameters:
  - `order_id`: UUID of the order to approve
- Description:
  - Updates order's credit status to 'approved'
  - Sets order status to 'validated'
  - Records the approving user and timestamp
  - Creates a notification of type 'credit_approved'
- Returns: The order UUID

#### reject_order_credit(order_id UUID, p_rejection_reason TEXT)
Rejects credit for an order.
- Parameters:
  - `order_id`: UUID of the order to reject
  - `p_rejection_reason`: Text explanation for rejection
- Description:
  - Updates order's credit status to 'rejected'
  - Records the rejecting user and timestamp
  - Stores the rejection reason
  - Creates a notification of type 'credit_rejected'
- Returns: The order UUID

#### reject_credit_by_validator(order_id UUID, p_rejection_reason TEXT)
Temporarily rejects credit (by a credit validator).
- Parameters:
  - `order_id`: UUID of the order
  - `p_rejection_reason`: Text explanation for rejection
- Description:
  - Updates order's credit status to 'rejected_by_validator'
  - This is different from full rejection and can be overridden by an executive
  - Stores the rejection reason
  - Creates a notification
- Returns: The order UUID

### Row Level Security (RLS) Policies

The database uses Row Level Security (RLS) extensively to control access. Key policies include:

#### Order Access Policies

- **credit_validators_can_update_credit_status**: Allows CREDIT_VALIDATOR role to update credit status fields
- **credit_validators_can_view_all_orders**: Allows CREDIT_VALIDATOR role to view all orders
- **dosificadores_can_view_orders**: Allows DOSIFICADOR role to view orders
- **managers_can_review_rejected_orders**: Allows EXECUTIVE and PLANT_MANAGER roles to review rejected orders
- **managers_can_view_all_orders**: Allows EXECUTIVE and PLANT_MANAGER roles to view all orders
- **managers_can_update_all_orders**: Allows EXECUTIVE and PLANT_MANAGER roles to update all orders
- **sales_agents_can_view_all_orders**: Allows SALES_AGENT role to view all orders
- **creators_can_view_own_orders**: Allows users to view orders they created
- **creators_can_edit_pending_orders**: Allows users to edit their own orders while in pending status
- **all_users_can_insert_orders**: Allows all authenticated users to create orders

## Data Flow

1. **Quote Creation**:
   - User creates quote for client with quote_details
   - Quote goes through approval process
   
2. **Order Creation**:
   - Order is created based on approved quote
   - Order contains order_items derived from quote_details
   - Credit validation process begins

3. **Credit Approval**:
   - Credit validators review order credit information
   - Orders can be approved, rejected, or temporarily rejected
   - Executives can override temporary rejections

4. **Order Fulfillment**:
   - After credit approval, order proceeds to fulfillment
   - Notifications are sent at various stages

## Common Constraints and Rules

1. Credit status must be one of: 'pending', 'approved', 'rejected', or 'rejected_by_validator'
2. Quote status must be one of: 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', or 'REJECTED'
3. Product types must be one of: 'STANDARD', 'SPECIAL', or 'QUOTED'
4. User roles must be one of: 'QUALITY_TEAM', 'PLANT_MANAGER', 'SALES_AGENT', 'EXECUTIVE', 'CREDIT_VALIDATOR', or 'DOSIFICADOR'

## Row-Level Security Logic

1. EXECUTIVE and PLANT_MANAGER roles have full access to view and modify all records
2. CREDIT_VALIDATOR role can view all orders and update credit status fields
3. SALES_AGENT role can view all orders but has limited editing capabilities
4. DOSIFICADOR role has view-only access to orders
5. All users can create new orders, but can only edit their own orders while in 'pending' state

This document provides the essential context needed to understand the database structure and make changes safely. When making modifications, always consider the existing relationships and security policies to maintain data integrity and access control. 