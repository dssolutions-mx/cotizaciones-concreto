import assert from 'node:assert'
import { parseCfdiXml } from './cfdiParser'

const minimalRep = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:pago20="http://www.sat.gob.mx/Pagos20"
  SubTotal="0" Total="0" Moneda="XXX" TipoDeComprobante="P" Fecha="2026-05-20T12:00:00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Proveedor SA"/>
  <cfdi:Receptor Rfc="BBB020202BBB" Nombre="Receptor SA" UsoCFDI="CP01"/>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2026-05-20T14:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00">
        <pago20:DoctoRelacionado IdDocumento="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
          ImpPagado="5000.00" NumParcialidad="1"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      UUID="99999999-8888-7777-6666-555555555555" FechaTimbrado="2026-05-20T12:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`

const parsed = parseCfdiXml(minimalRep)

assert.strictEqual(parsed.tipo_comprobante, 'P')
assert.strictEqual(parsed.uuid, '99999999-8888-7777-6666-555555555555')
assert.strictEqual(parsed.pagos_doctos.length, 1)
assert.strictEqual(parsed.pagos_doctos[0].docto_relacionado_uuid, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
assert.strictEqual(parsed.pagos_doctos[0].imp_pagado, 5000)
assert.strictEqual(parsed.pagos_doctos[0].num_parcialidad, 1)
assert.strictEqual(parsed.pagos_doctos[0].fecha_pago, '2026-05-20')
assert.strictEqual(parsed.pagos_doctos[0].forma_pago_p, '03')
assert.strictEqual(parsed.pagos_doctos[0].moneda_p, 'MXN')

console.log('cfdiParser.rep.test.ts: ok')
