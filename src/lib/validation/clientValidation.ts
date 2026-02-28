export interface ClientValidationInput {
  business_name?: string;
  contact_name?: string;
  phone?: string;
  requires_invoice?: boolean;
  rfc?: string;
  client_code?: string;
}

export interface ClientValidationErrors {
  business_name?: string;
  contact_name?: string;
  phone?: string;
  rfc?: string;
}

export function validateClientForm(input: ClientValidationInput): ClientValidationErrors {
  const errors: ClientValidationErrors = {};

  if (!input.business_name?.trim()) {
    errors.business_name = 'El nombre del negocio es obligatorio';
  }

  if (!input.contact_name?.trim()) {
    errors.contact_name = 'El nombre de contacto es obligatorio';
  }

  if (!input.phone?.trim()) {
    errors.phone = 'El número de teléfono es obligatorio';
  }

  if (input.requires_invoice) {
    const rfcValue = input.rfc ?? input.client_code ?? '';
    if (!rfcValue.trim()) {
      errors.rfc = 'El RFC es obligatorio cuando el cliente requiere factura';
    }
  }

  return errors;
}

