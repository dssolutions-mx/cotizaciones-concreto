Okay, let's dive into a much more granular level of detail for every component within the `public` schema.

## Public Schema Detailed Documentation

---

### Tables

---

#### `additional_services`

*   **Purpose**: Stores information about supplementary services offered alongside concrete products.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the service.
    *   `code` (character varying, not null, unique): Short code identifying the service.
    *   `description` (text, not null): Detailed description of the service.
    *   `price` (numeric, not null): The price charged for this service.
    *   `is_active` (boolean, default: `true`): Indicates if the service is currently available.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
*   **Relationships**: None directly listed in the initial schema dump, but likely used in `order_items` or similar.

---

#### `administrative_costs`

*   **Purpose**: Tracks various types of administrative and overhead costs for the business.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the cost entry.
    *   `cost_type` (character varying, not null): Category or type of administrative cost.
    *   `description` (text): Optional description of the cost.
    *   `amount` (numeric, not null): The monetary amount of the cost.
    *   `effective_date` (timestamp with time zone, not null): Date when this cost became effective.
    *   `end_date` (timestamp with time zone): Date when this cost is no longer effective (optional).
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
*   **Relationships**: None.

---

#### `clients`

*   **Purpose**: Central table storing information about customers.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the client.
    *   `business_name` (character varying, not null): Official business name of the client.
    *   `client_code` (character varying, unique): Internal code used to identify the client.
    *   `rfc` (character varying): Client's RFC (Mexican Tax ID).
    *   `requires_invoice` (boolean, default: `false`): Indicates if the client typically requires formal invoices.
    *   `address` (text): Client's primary address.
    *   `contact_name` (character varying): Name of the primary contact person.
    *   `email` (character varying): Contact email address.
    *   `phone` (character varying): Contact phone number.
    *   `credit_status` (character varying): Client's current credit status (e.g., 'approved', 'pending', 'rejected').
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `updated_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of last update.
*   **Relationships**:
    *   Referenced by `product_prices` (`client_id`), `orders` (`client_id`), `construction_sites` (`client_id`), `quotes` (`client_id`), `order_history` (`client_id`).

---

#### `commercial_terms`

*   **Purpose**: Stores the specific commercial terms and conditions associated with a quote.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the term.
    *   `quote_id` (uuid): Foreign key linking to the `quotes` table.
    *   `term_type` (character varying, not null): Type or category of the term (e.g., 'Payment', 'Delivery').
    *   `description` (text, not null): The text of the term or condition.
    *   `sort_order` (integer, not null): Order in which terms should be displayed.
    *   `is_active` (boolean, default: `true`): Indicates if the term is currently active for the quote.
*   **Relationships**:
    *   References `quotes` (`quote_id`).

---

#### `construction_sites`

*   **Purpose**: Details specific locations where clients require concrete delivery.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the site.
    *   `name` (character varying, not null): Name of the construction site.
    *   `client_id` (uuid, not null): Foreign key linking to the `clients` table.
    *   `location` (text): Address or description of the site's location.
    *   `access_restrictions` (text): Notes on any difficulties or restrictions for accessing the site.
    *   `special_conditions` (text): Any special conditions relevant to deliveries at this site.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `updated_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of last update.
    *   `is_active` (boolean, default: `true`, not null): Indicates if the site is currently active.
*   **Relationships**:
    *   References `clients` (`client_id`).
    *   Likely referenced implicitly by `orders` and `quotes` via their `construction_site` text field, although not a direct foreign key.

---

#### `material_prices`

*   **Purpose**: Tracks the cost of raw materials used in concrete production over time.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the price entry.
    *   `material_type` (character varying, not null): Type of material (e.g., 'cement', 'sand', 'gravel').
    *   `price_per_unit` (numeric, not null): Cost of the material per its standard unit.
    *   `effective_date` (timestamp with time zone, not null): Date from which this price is valid.
    *   `end_date` (timestamp with time zone): Date until which this price is valid (optional).
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
*   **Relationships**: None. Used by functions calculating recipe/product costs.

---

#### `material_quantities`

*   **Purpose**: Specifies the quantity of each material required for a specific version of a recipe.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the quantity entry.
    *   `recipe_version_id` (uuid): Foreign key linking to the `recipe_versions` table.
    *   `material_type` (character varying, not null): Type of material used.
    *   `quantity` (double precision, not null): Amount of the material required.
    *   `unit` (character varying, not null): Unit of measurement for the quantity (e.g., 'kg', 'm3').
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
*   **Relationships**:
    *   References `recipe_versions` (`recipe_version_id`).

---

#### `order_history`

*   **Purpose**: Stores an archival snapshot of completed or historical orders for reporting.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier.
    *   `client_id` (uuid): Link to the client associated with the historical order.
    *   `week_number` (character varying, not null): Week number when the order occurred.
    *   `order_number` (character varying, not null, unique): Original order number.
    *   `delivery_site` (character varying, not null): Name of the delivery site.
    *   `location` (character varying, not null): Location of the delivery.
    *   `concrete_type` (character varying, not null): Type of concrete ordered.
    *   `volume` (numeric, not null): Volume of concrete ordered.
    *   `concrete_price` (numeric, not null): Price per unit of concrete.
    *   `pump_price` (numeric): Price for pump service, if applicable.
    *   `total_amount` (numeric, not null): Total value of the order.
    *   `pump_service` (character varying): Details of pump service, if applicable.
    *   `special_requirements` (text): Any special notes from the order.
    *   `delivery_date` (date, not null): Date of delivery.
    *   `delivery_time` (time without time zone, not null): Time of delivery.
    *   `credit_validation_status` (character varying): Credit status at the time.
    *   `management_validation_status` (character varying): Management status at the time.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of original creation.
*   **Relationships**:
    *   References `clients` (`client_id`).

---

#### `product_prices`

*   **Purpose**: Defines prices for specific concrete products, potentially customized per client or quote.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the product price entry.
    *   `code` (character varying, not null, unique): Unique code for this product price instance.
    *   `description` (text, not null): Description of the concrete product.
    *   `fc_mr_value` (integer, not null): Strength value (f'c or MR).
    *   `type` (character varying, not null, check: `type::text = ANY (ARRAY['STANDARD'::character varying::text, 'SPECIAL'::character varying::text, 'QUOTED'::character varying::text])`): Classification (Standard, Special, Quoted).
    *   `age_days` (integer, not null): Age in days for strength measurement.
    *   `placement_type` (character varying, not null): Type of placement (e.g., 'Direct', 'Pumped').
    *   `max_aggregate_size` (integer, not null): Maximum aggregate size in mm.
    *   `slump` (integer, not null): Slump value in cm.
    *   `base_price` (numeric, not null): Base price per unit before adjustments.
    *   `recipe_id` (uuid): Foreign key linking to the `recipes` table (the specific recipe used for this price).
    *   `is_active` (boolean, default: `true`): Whether this price is currently active.
    *   `effective_date` (timestamp with time zone, not null): Date from which this price is valid.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `updated_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of last update.
    *   `quote_id` (uuid): Foreign key linking to `quotes` (if this price is specific to a quote).
    *   `original_recipe_id` (uuid): Foreign key linking to `recipes` (potentially the base recipe if modified for a quote).
    *   `approval_date` (timestamp with time zone): Date this price was approved (if applicable).
    *   `client_id` (uuid, not null, check: `client_id IS NOT NULL`): Foreign key linking to `clients` (mandatory).
    *   `construction_site` (text): Construction site associated with this price (for site-specific pricing).
*   **Relationships**:
    *   References `quotes` (`quote_id`).
    *   References `recipes` (`recipe_id`, `original_recipe_id`).
    *   References `clients` (`client_id`).
    *   Referenced by `quote_details` (`product_id`).

---

#### `recipe_versions`

*   **Purpose**: Tracks different versions of a concrete recipe, allowing for historical tracking and activation.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the version.
    *   `recipe_id` (uuid): Foreign key linking to the parent `recipes` table.
    *   `version_number` (integer, not null): Sequential version number for the recipe.
    *   `effective_date` (timestamp with time zone, not null): Date this version becomes effective.
    *   `is_current` (boolean, default: `true`): Flag indicating if this is the currently active version.
    *   `notes` (text): Optional notes about changes in this version.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `loaded_to_k2` (boolean, default: `false`): Flag indicating if this version has been loaded into the K2 system.
*   **Relationships**:
    *   References `recipes` (`recipe_id`).
    *   Referenced by `material_quantities` (`recipe_version_id`), `recipe_reference_materials` (`recipe_version_id`).

---

#### `recipes`

*   **Purpose**: Defines the base specifications for different concrete mix designs.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the recipe.
    *   `recipe_code` (character varying, not null, unique): Unique code identifying the recipe.
    *   `strength_fc` (double precision, not null): Compressive strength (f'c) or flexural strength (MR) value.
    *   `age_days` (integer, not null): Age in days at which the specified strength is measured.
    *   `placement_type` (character varying, not null): Intended placement method (e.g., 'Direct', 'Pumped').
    *   `max_aggregate_size` (double precision, not null): Maximum size of aggregate material in the mix (mm).
    *   `slump` (double precision, not null): Measure of concrete consistency (cm).
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `updated_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of last update.
*   **Relationships**:
    *   Referenced by `remisiones` (`recipe_id`), `product_prices` (`original_recipe_id`, `recipe_id`), `quote_details` (`recipe_id`), `recipe_versions` (`recipe_id`).

---

#### `recipe_reference_materials`

*   **Purpose**: Stores reference SSS (Saturated Surface-Dry) values for materials within specific recipe versions.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier.
    *   `recipe_version_id` (uuid, not null): Foreign key linking to `recipe_versions`.
    *   `material_type` (character varying, not null): Type of material (e.g., 'basaltic_sand', 'gravel_20mm').
    *   `sss_value` (numeric, not null): SSS value for the material in this recipe version.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
*   **Relationships**:
    *   References `recipe_versions` (`recipe_version_id`).

---

#### `quote_details`

*   **Purpose**: Represents individual line items within a quote, detailing products and pricing.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the detail line.
    *   `quote_id` (uuid): Foreign key linking to the parent `quotes` table.
    *   `product_id` (uuid): Foreign key linking to the specific `product_prices` entry used.
    *   `volume` (numeric, not null): Volume of the product being quoted.
    *   `base_price` (numeric, not null): Base price per unit for this product.
    *   `profit_margin` (numeric, not null): Profit margin applied to this line item.
    *   `final_price` (numeric, not null): Calculated final price per unit.
    *   `pump_service` (boolean, default: `false`): Indicates if pump service is included.
    *   `pump_price` (numeric): Price for the pump service, if applicable.
    *   `total_amount` (numeric, not null): Total value for this line item (final_price * volume + pump_price).
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `recipe_id` (uuid): Foreign key linking to the `recipes` table used for this line item.
    *   `includes_vat` (boolean, default: `false`, not null): Indicates if VAT is included in the price.
*   **Relationships**:
    *   References `recipes` (`recipe_id`).
    *   References `product_prices` (`product_id`).
    *   References `quotes` (`quote_id`).
    *   Referenced by `order_items` (`quote_detail_id`).

---

#### `quotes`

*   **Purpose**: Represents a formal quotation provided to a client.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the quote.
    *   `quote_number` (character varying, not null, unique): Unique number identifying the quote.
    *   `client_id` (uuid): Foreign key linking to the `clients` table.
    *   `construction_site` (character varying, not null): Name of the target construction site.
    *   `location` (character varying, not null): Location details for the site.
    *   `status` (character varying, not null, default: `'DRAFT'::character varying`, check: `status::text = ANY (ARRAY['DRAFT'::character varying::text, 'PENDING_APPROVAL'::character varying::text, 'APPROVED'::character varying::text, 'REJECTED'::character varying::text])`): Current status of the quote (Draft, Pending Approval, Approved, Rejected).
    *   `validity_date` (date, not null): Date until which the quote is valid.
    *   `created_by` (uuid, not null): Foreign key linking to `auth.users`, indicating the creator.
    *   `approved_by` (uuid): Foreign key linking to `auth.users`, indicating the approver (if applicable).
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `updated_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of last update.
    *   `approval_date` (timestamp with time zone): Timestamp when the quote was approved.
    *   `rejection_date` (timestamp with time zone): Timestamp when the quote was rejected.
    *   `rejection_reason` (text): Reason for rejection, if applicable.
*   **Relationships**:
    *   References `clients` (`client_id`).
    *   Referenced by `quote_details` (`quote_id`), `orders` (`quote_id`), `commercial_terms` (`quote_id`), `product_prices` (`quote_id`).

---

#### `remisiones`

*   **Purpose**: Represents a delivery ticket or receipt for concrete delivered as part of an order.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the remisión.
    *   `order_id` (uuid, not null): Foreign key linking to the `orders` table.
    *   `remision_number` (character varying, not null): Unique number identifying the delivery ticket.
    *   `fecha` (date, not null): Date of the delivery.
    *   `hora_carga` (time without time zone, not null): Time the truck was loaded.
    *   `volumen_fabricado` (numeric, not null): Volume of concrete produced/delivered for this ticket.
    *   `conductor` (character varying): Name of the truck driver.
    *   `unidad` (character varying): Identifier for the delivery truck/unit.
    *   `tipo_remision` (character varying, not null, check: `tipo_remision::text = ANY (ARRAY['CONCRETO'::character varying, 'BOMBEO'::character varying]::text[])`): Type of delivery (Concrete or Pumping service).
    *   `created_at` (timestamp with time zone, default: `now()`): Timestamp of creation.
    *   `created_by` (uuid): Foreign key linking to `auth.users`, user who created the record.
    *   `recipe_id` (uuid): Foreign key linking to the `recipes` table used for this delivery.
    *   `designacion_ehe` (text): EHE designation (Spanish concrete standard).
*   **Relationships**:
    *   References `recipes` (`recipe_id`).
    *   References `orders` (`order_id`).
    *   References `auth.users` (`created_by`).
    *   Referenced by `remision_materiales` (`remision_id`).

---

#### `remision_materiales`

*   **Purpose**: Records the actual and theoretical quantities of materials used for a specific delivery (remisión).
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier.
    *   `remision_id` (uuid, not null): Foreign key linking to the `remisiones` table.
    *   `material_type` (character varying, not null): Type of material used.
    *   `cantidad_real` (numeric): Actual quantity of the material used.
    *   `cantidad_teorica` (numeric): Theoretical quantity based on the recipe.
*   **Relationships**:
    *   References `remisiones` (`remision_id`).

---

#### `user_profiles`

*   **Purpose**: Stores application-specific user data, extending the built-in `auth.users` table.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, not null): Foreign key linking to `auth.users`. Should match the user's auth ID.
    *   `email` (text, not null, unique): User's email address.
    *   `first_name` (text): User's first name.
    *   `last_name` (text): User's last name.
    *   `role` (text, not null, check: `role = ANY (ARRAY['QUALITY_TEAM'::text, 'PLANT_MANAGER'::text, 'SALES_AGENT'::text, 'EXECUTIVE'::text, 'CREDIT_VALIDATOR'::text, 'DOSIFICADOR'::text])`): User's assigned role within the application.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `updated_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of last update.
    *   `is_active` (boolean, default: `true`): Indicates if the user profile is active.
*   **Relationships**:
    *   References `auth.users` (`id`).

---

#### `orders`

*   **Purpose**: Represents a confirmed customer order for concrete products.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the order.
    *   `quote_id` (uuid, not null): Foreign key linking to the originating `quotes` table.
    *   `client_id` (uuid, not null): Foreign key linking to the `clients` table.
    *   `construction_site` (character varying, not null): Name of the target construction site.
    *   `order_number` (character varying, not null, unique): Unique number identifying the order.
    *   `requires_invoice` (boolean, default: `false`, not null): Indicates if a formal invoice is needed.
    *   `delivery_date` (date, not null): Scheduled date for delivery.
    *   `delivery_time` (time without time zone, not null): Scheduled time for delivery.
    *   `special_requirements` (text): Any special instructions or requirements for the order.
    *   `total_amount` (numeric, not null): Estimated total value of the order.
    *   `credit_status` (character varying, not null, default: `'pending'::character varying`, check: `credit_status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'rejected_by_validator'::character varying]::text[])`): Current credit validation status.
    *   `credit_validated_by` (uuid): Foreign key linking to `auth.users`, the validator who actioned the credit status.
    *   `credit_validation_date` (timestamp with time zone): Timestamp of credit validation action.
    *   `order_status` (character varying, not null, default: `'created'::character varying`): Overall status of the order (e.g., 'created', 'scheduled', 'delivered', 'cancelled').
    *   `created_by` (uuid, not null): Foreign key linking to `auth.users`, the user who created the order.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `updated_at` (timestamp with time zone): Timestamp of last update.
    *   `rejection_reason` (text): Reason if the order's credit was rejected.
   
    *   References `auth.users` (`created_by`, `credit_validated_by`).
    *   References `clients` (`client_id`).
    *   References `quotes` (`quote_id`).
    *   Referenced by `order_items` (`order_id`), `remisiones` (`order_id`), `order_notifications` (`order_id`).

---

#### `order_items`

*   **Purpose**: Represents individual product lines within an order.
*   **RLS Enabled**: False (Note: This seems unusual given other tables; verify if this is intended or an oversight).
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the order item.
    *   `order_id` (uuid, not null): Foreign key linking to the parent `orders` table.
    *   `quote_detail_id` (uuid): Foreign key linking to the corresponding `quote_details` line.
    *   `product_type` (character varying, not null): Description or type of the concrete product.
    *   `volume` (numeric, not null): Ordered volume of the product.
    *   `unit_price` (numeric, not null): Price per unit for this item.
    *   `total_price` (numeric, not null): Total price for this line item (volume * unit_price).
    *   `has_pump_service` (boolean, default: `false`): Indicates if pump service is included for this item.
    *   `pump_price` (numeric): Price for the pump service, if applicable.
    *   `has_empty_truck_charge` (boolean, default: `false`): Indicates if an empty truck charge applies.
    *   `empty_truck_volume` (numeric): Volume associated with the empty truck charge.
    *   `empty_truck_price` (numeric): Cost of the empty truck charge.
    *   `created_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp of creation.
    *   `pump_volume` (numeric, default: `NULL::numeric`): Volume specifically for pumping service (can differ from concrete volume).
    *   `concrete_volume_delivered` (numeric, default: 0): Actual volume of concrete delivered for this item.
    *   `pump_volume_delivered` (numeric, default: 0): Actual volume pumped for this item.
*   **Relationships**:
    *   References `orders` (`order_id`).
    *   References `quote_details` (`quote_detail_id`).

---

#### `order_notifications`

*   **Purpose**: Logs notifications sent related to order status changes, particularly credit validation.
*   **RLS Enabled**: Yes
*   **Primary Key**: `id` (uuid)
*   **Columns**:
    *   `id` (uuid, default: `uuid_generate_v4()`, not null): Unique identifier for the notification record.
    *   `order_id` (uuid, not null): Foreign key linking to the `orders` table.
    *   `notification_type` (character varying, not null): Type of notification (e.g., 'CreditValidationRequest', 'CreditApproved').
    *   `recipient` (character varying, not null): Identifier of the recipient (e.g., email address, user ID, system).
    *   `sent_at` (timestamp with time zone, default: `timezone('utc'::text, now())`): Timestamp when the notification was sent.
    *   `delivery_status` (character varying): Status indicating if the notification was successfully delivered (e.g., 'Sent', 'Failed').
*   **Relationships**:
    *   References `orders` (`order_id`).

---

### Functions

---

*   **`actualizar_volumenes_orden()`**
    *   **Purpose**: Triggered function to update `concrete_volume_delivered` and `pump_volume_delivered` fields in the `order_items` table based on data inserted or updated in the `remisiones` table. It ensures order fulfillment accurately reflects deliveries.
*   **`approve_order_credit(order_id uuid, validator_id uuid)`** (Signature assumed)
    *   **Purpose**: Sets the `credit_status` of a specific order to 'approved', records the `credit_validated_by` user ID, and sets the `credit_validation_date`.
*   **`before_remision_insert_or_update()`**
    *   **Purpose**: Triggered function executed before inserting/updating `remisiones`. Likely populates `cantidad_teorica` based on the `recipe_id` and `volumen_fabricado` and potentially performs data validation.

*   **`create_client_with_sites(business_name ..., sites_data ...)`** (Signature illustrative)
    *   **Purpose**: A convenience function to create a new client record in `clients` and associated records in `construction_sites` within a single transaction.
*   **`create_order_from_quote(quote_id uuid, user_id uuid, delivery_date date, delivery_time time, ...)`** (Signature assumed)
    *   **Purpose**: Takes an approved `quote_id`, copies relevant data to create a new record in `orders` and corresponding records in `order_items`, linking back to the quote and quote details.
*   **`create_order_with_details(...)`** (Likely overloaded or has JSON parameter)
    *   **Purpose**: Allows creating an order and its items simultaneously, potentially bypassing the quote process for direct orders. Ensures atomicity.
*   **`find_recipe_by_code(recipe_code character varying)`** (Signature assumed)
    *   **Purpose**: Returns the `id` or full record of a recipe from the `recipes` table based on its unique `recipe_code`.
*   **`handle_credit_validation_webhook_insert()`**
    *   **Purpose**: Triggered function on `orders` insert. It likely sends a request (e.g., using `pg_net`) to an external service or queue to initiate the credit validation process for the new order and logs this action in `order_notifications`.
*   **`handle_credit_validation_webhook_update()`**
    *   **Purpose**: Triggered function on `orders` update, specifically when `credit_status` changes. It might notify relevant parties or systems about the updated credit status via webhooks or other mechanisms.
*   **`handle_new_user()`**
    *   **Purpose**: Triggered function executed when a new user is created in `auth.users`. It creates a corresponding record in the `public.user_profiles` table, populating `id` and `email`, possibly setting a default role.
*   **`process_client_payment()`** (Deprecated)
    *   **Purpose**: Previously used to update client balances when payments were recorded.
*   **`recalculate_order_balance(order_id uuid)`** (Deprecated)
    *   **Purpose**: Previously used to re-calculate order balances.
*   **`reject_credit_by_validator(order_id uuid, validator_id uuid, reason text)`** (Signature assumed)
    *   **Purpose**: Sets the `credit_status` of a specific order to 'rejected_by_validator', records the `credit_validated_by` user ID, the `credit_validation_date`, and the `rejection_reason`.
*   **`reject_order_credit(order_id uuid, reason text)`** (Signature assumed)
    *   **Purpose**: Sets the `credit_status` of an order to 'rejected', potentially automatically if certain conditions aren't met, and records the `rejection_reason`.
*   **`update_client_balance(client_id uuid, site_name text)`** (Deprecated)
    *   **Purpose**: Previously used to update client balances.
*   **`update_final_balance()`** (Deprecated)
    *   **Purpose**: Previously used for order balance tracking.

---

### Triggers

---

*   **`payment_process_trigger`** (Deprecated)
    *   **Table**: Formerly on `client_payments`
    *   **Event**: INSERT
    *   **Function**: `process_client_payment()`
    *   **Context**: Previously used to update client balances when payments were recorded.
*   **`credit_validation_webhook_insert`**
    *   **Table**: `orders`
    *   **Event**: INSERT
    *   **Function**: `handle_credit_validation_webhook_insert()`
    *   **Context**: Initiates the external credit check process when a new order is created.
*   **`order_preliminar_balance_trigger`** (Deprecated)
    *   **Table**: `orders`
    *   **Event**: INSERT
    *   **Function**: `calculate_preliminar_balance()`
    *   **Context**: Previously used to capture the client's balance before the new order.
*   **`credit_validation_webhook_update`**
    *   **Table**: `orders`
    *   **Event**: UPDATE
    *   **Function**: `handle_credit_validation_webhook_update()`
    *   **Context**: Sends notifications or triggers actions when the credit status of an existing order is updated.
*   **`after_remision_insert_or_update`**
    *   **Table**: `remisiones`
    *   **Event**: INSERT, UPDATE
    *   **Function**: `actualizar_volumenes_orden()`
    *   **Context**: Keeps the delivered volume totals on the `order_items` accurate based on delivery tickets.
*   **`before_remision_insert_or_update`**
    *   **Table**: `remisiones`
    *   **Event**: INSERT, UPDATE
    *   **Function**: `before_remision_insert_or_update()`
    *   **Context**: Performs preparatory calculations or validations before saving delivery ticket data, such as calculating theoretical material quantities.

---

### RLS Policies (Public Schema Only)

---

**Updated 2025-06-14: Duplicate policies have been consolidated and schemas updated**

#### `additional_services`
*   **`additional_services_management_access`**: Allows INSERT, UPDATE, DELETE for users whose profile role is 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`
*   **`read_additional_services_access`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true` (within the context of RLS, typically defaults to authenticated if no specific role check)

#### `administrative_costs`
*   **`plant_manager_admin_costs_access`**: Allows INSERT, UPDATE, DELETE for 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`
*   **`read_admin_costs_access`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`

#### `clients`
*   **`everyone_can_read_clients`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`
*   **`manage_clients_access`**: Allows INSERT, UPDATE, DELETE for 'SALES_AGENT', 'PLANT_MANAGER', or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['SALES_AGENT'::text, 'PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`

#### `commercial_terms`
*   **`commercial_terms_management_access`**: Allows INSERT, UPDATE, DELETE for 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`
*   **`read_commercial_terms_access`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`

#### `construction_sites`
*   **`everyone_can_read_construction_sites`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`
*   **`manage_construction_sites_access`**: Allows INSERT, UPDATE, DELETE for 'SALES_AGENT', 'PLANT_MANAGER', or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['SALES_AGENT'::text, 'PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`

#### `material_prices`
*   **`everyone_can_read_material_prices`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`
*   **`quality_team_full_material_prices_access`**: Allows INSERT, UPDATE, DELETE for 'QUALITY_TEAM' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = 'QUALITY_TEAM'::text OR user_profiles.role = 'EXECUTIVE'::text)))`

#### `material_quantities`
*   **`material_quantities_management_access`**: Allows INSERT, UPDATE, DELETE for 'QUALITY_TEAM' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['QUALITY_TEAM'::text, 'EXECUTIVE'::text]))))`
*   **`read_material_quantities_access`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`

#### `order_history`
*   **`order_history_edit_access`**: Allows UPDATE, DELETE for 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`
*   **`order_history_view_access`**: Allows SELECT for 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`

#### `orders`
*   **`all_users_can_insert_orders`**: Allows INSERT for any authenticated user.
    *   `Definition`: `true`
*   **`creators_can_edit_pending_orders`**: Allows UPDATE if the current user is the `created_by` user AND the `credit_status` is 'pending'.
    *   `Definition`: `auth.uid() = created_by AND credit_status::text = 'pending'::text`
*   **`creators_can_view_own_orders`**: Allows SELECT if the current user is the `created_by` user.
    *   `Definition`: `auth.uid() = created_by`
*   **`credit_validators_can_update_credit_status`**: Allows UPDATE for 'CREDIT_VALIDATOR' with check on allowed credit status values.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'CREDIT_VALIDATOR'::text))`
    *   `With check`: `((credit_status)::text = ANY (ARRAY[('approved'::character varying)::text, ('rejected'::character varying)::text, ('rejected_by_validator'::character varying)::text]))`
*   **`credit_validators_can_view_all_orders`**: Allows SELECT for 'CREDIT_VALIDATOR'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'CREDIT_VALIDATOR'::text))`
*   **`dosificadores_can_view_orders`**: Allows SELECT for 'DOSIFICADOR'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'DOSIFICADOR'::text))`
*   **`managers_can_review_rejected_orders`**: Allows UPDATE for 'EXECUTIVE' or 'PLANT_MANAGER' with check on allowed credit status values.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['EXECUTIVE'::text, 'PLANT_MANAGER'::text]))))`
    *   `With check`: `((credit_status)::text = ANY (ARRAY[('approved'::character varying)::text, ('rejected'::character varying)::text]))`
*   **`managers_can_update_all_orders`**: Allows UPDATE for 'EXECUTIVE' or 'PLANT_MANAGER'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['EXECUTIVE'::text, 'PLANT_MANAGER'::text]))))`
*   **`managers_can_view_all_orders`**: Allows SELECT for 'EXECUTIVE' or 'PLANT_MANAGER'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['EXECUTIVE'::text, 'PLANT_MANAGER'::text]))))`
*   **`sales_agents_can_view_all_orders`**: Allows SELECT for 'SALES_AGENT'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'SALES_AGENT'::text))`

#### `product_prices`
*   **`everyone_can_read_product_prices`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`
*   **`role_based_product_prices_management`**: Allows INSERT, UPDATE, DELETE for 'QUALITY_TEAM', 'PLANT_MANAGER', or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['QUALITY_TEAM'::text, 'PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`

#### `quote_details`
*   **`quote_details_insert_access`**: Allows INSERT for any authenticated user.
    *   `Definition`: `null`
*   **`quote_details_update_access`**: Allows UPDATE if the user created the parent quote AND it's a 'DRAFT', OR if the user is 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM quotes WHERE quotes.id = quote_details.quote_id AND (quotes.created_by = auth.uid() AND quotes.status::text = 'DRAFT'::text OR (EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text])))))))`
*   **`quote_details_view_access`**: Allows SELECT if the user created the parent quote OR if the user is 'PLANT_MANAGER', 'SALES_AGENT', or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM quotes WHERE quotes.id = quote_details.quote_id AND (quotes.created_by = auth.uid() OR (EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'SALES_AGENT'::text, 'EXECUTIVE'::text])))))))`

#### `quotes`
*   **`managers_approve_quotes`**: Allows UPDATE only for 'PLANT_MANAGER' or 'EXECUTIVE' AND only if the quote status is 'PENDING_APPROVAL'. (This policy specifically controls the approval action).
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text])))) AND status::text = 'PENDING_APPROVAL'::text`
*   **`sales_agents_insert_quotes`**: Allows INSERT for any authenticated user (likely intended for 'SALES_AGENT' but definition is broad).
    *   `Definition`: `null`
*   **`sales_agents_update_own_draft_quotes`**: Allows UPDATE if the user created the quote AND its status is 'DRAFT', OR if the user is 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `created_by = auth.uid() AND status::text = 'DRAFT'::text OR (EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`
*   **`sales_agents_view_quotes`**: Allows SELECT if the user created the quote, OR if the quote is 'APPROVED' and the user is a 'SALES_AGENT', OR if the user is 'PLANT_MANAGER' or 'EXECUTIVE'.
    *   `Definition`: `created_by = auth.uid() OR status::text = 'APPROVED'::text AND (EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'SALES_AGENT'::text)) OR (EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['PLANT_MANAGER'::text, 'EXECUTIVE'::text]))))`
*   **`send_to_approval_policy`**: Allows UPDATE if the user created the quote AND its status is 'DRAFT'. (This policy controls the action of submitting for approval).
    *   `Definition`: `created_by = auth.uid() AND status::text = 'DRAFT'::text`

#### `recipe_reference_materials`
*   **`everyone_can_read_recipe_references`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`
*   **`manage_recipe_materials_policy`**: Allows INSERT, UPDATE, DELETE for 'QUALITY_TEAM' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['QUALITY_TEAM'::text, 'EXECUTIVE'::text]))))`

#### `recipe_versions`
*   **`everyone_can_read_recipe_versions`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`
*   **`manage_recipe_versions_policy`**: Allows INSERT, UPDATE, DELETE for 'QUALITY_TEAM' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['QUALITY_TEAM'::text, 'EXECUTIVE'::text]))))`

#### `recipes`
*   **`everyone_can_read_recipes`**: Allows SELECT for all authenticated users.
    *   `Definition`: `true`
*   **`manage_recipes_policy`**: Allows INSERT, UPDATE, DELETE for 'QUALITY_TEAM' or 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['QUALITY_TEAM'::text, 'EXECUTIVE'::text]))))`

#### `remision_materiales`
*   **`dosificadores_can_insert_materiales`**: Allows INSERT for any authenticated user (intended for 'DOSIFICADOR').
    *   `Definition`: `null`
*   **`dosificadores_can_view_materiales`**: Allows SELECT for 'DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', or 'SALES_AGENT'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['DOSIFICADOR'::text, 'PLANT_MANAGER'::text, 'EXECUTIVE'::text, 'SALES_AGENT'::text]))))`

#### `remisiones`
*   **`dosificadores_can_insert_remisiones`**: Allows INSERT for any authenticated user (intended for 'DOSIFICADOR').
    *   `Definition`: `null`
*   **`dosificadores_can_view_remisiones`**: Allows SELECT for 'DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', or 'SALES_AGENT'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND (user_profiles.role = ANY (ARRAY['DOSIFICADOR'::text, 'PLANT_MANAGER'::text, 'EXECUTIVE'::text, 'SALES_AGENT'::text]))))`

#### `user_profiles`
*   **`authenticated_users_can_view_profiles`**: Allows SELECT for any authenticated user.
    *   `Definition`: `auth.role() = 'authenticated'::text`
*   **`executives_can_delete_profiles`**: Allows DELETE only for 'EXECUTIVE'.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles user_profiles_1 WHERE user_profiles_1.id = auth.uid() AND user_profiles_1.role = 'EXECUTIVE'::text))`
*   **`executives_can_insert_profiles`**: Allows INSERT only for 'EXECUTIVE'. (Note: `null` definition means default, but the policy name implies restriction).
    *   `Definition`: `null`
*   **`executives_can_update_any_profile`**: Allows UPDATE for 'EXECUTIVE' on any profile.
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles user_profiles_1 WHERE user_profiles_1.id = auth.uid() AND user_profiles_1.role = 'EXECUTIVE'::text))`
*   **`only_executives_can_update_roles`**: Allows UPDATE only for 'EXECUTIVE'. (This acts as a check constraint for the `role` column update).
    *   `Definition`: `(EXISTS ( SELECT 1 FROM user_profiles user_profiles_1 WHERE user_profiles_1.id = auth.uid() AND user_profiles_1.role = 'EXECUTIVE'::text))`
*   **`users_can_update_own_profile_except_role`**: Allows UPDATE if the user is updating their *own* profile (`id = auth.uid()`). This policy doesn't explicitly prevent role updates, but relies on `only_executives_can_update_roles` to enforce that.
    *   `Definition`: `id = auth.uid()`

This provides a detailed parameter-level view of the public schema's structure and access controls.

## Deprecated Tables and Functions

As of the June 14, 2025 update, the following tables have been removed from the schema:

### Removed Tables
- **`client_balances`**: This table previously tracked client payment balances, but its functionality has been consolidated into the `orders` table.
- **`client_payments`**: This table previously stored payment records, but this functionality has been replaced with a more streamlined approach.

### Consolidated Triggers and Functions
The following functions are no longer in use:
- `process_client_payment()`: Previously handled client payment processing
- `update_client_balance()`: Previously updated client balance records

### Schema Simplification
The `orders` table has been consolidated to remove duplicate policies, and the balance tracking now happens directly within the `orders` table itself instead of in separate tables.