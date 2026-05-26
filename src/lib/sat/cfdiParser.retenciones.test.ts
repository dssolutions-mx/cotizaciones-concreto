import assert from 'node:assert'
import { parseCfdiXml } from './cfdiParser'

const minimalCfdi = (retencionesXml: string) => `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  SubTotal="1000.00" Descuento="0" Total="1047.50" Moneda="MXN" TipoDeComprobante="I" Fecha="2026-04-01T10:00:00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Proveedor SA"/>
  <cfdi:Receptor Rfc="BBB020202BBB" Nombre="Receptor SA" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="10101500" Cantidad="1" ClaveUnidad="H87"
      Descripcion="Servicio" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00" TotalImpuestosRetenidos="112.50">
    <cfdi:Traslados>
      <cfdi:Traslado Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00" Base="1000.00"/>
    </cfdi:Traslados>
    <cfdi:Retenciones>
      ${retencionesXml}
    </cfdi:Retenciones>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      UUID="11111111-2222-3333-4444-555555555555" FechaTimbrado="2026-04-01T10:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`

const parsed = parseCfdiXml(
  minimalCfdi(`
      <cfdi:Retencion Impuesto="001" Importe="12.50" TasaOCuota="0.012500"/>
      <cfdi:Retencion Impuesto="001" Importe="60.00" TasaOCuota="0.060000"/>
      <cfdi:Retencion Impuesto="002" Importe="40.00" TasaOCuota="0.040000"/>
    `),
)

assert.strictEqual(parsed.retenciones.length, 3)
assert.strictEqual(parsed.retenciones[0].impuesto_sat, '001')
assert.strictEqual(parsed.retenciones[0].importe, 12.5)
assert.strictEqual(parsed.retenciones[1].importe, 60)
assert.strictEqual(parsed.retenciones[2].impuesto_sat, '002')
assert.strictEqual(parsed.isr_retenido, 72.5)
assert.strictEqual(parsed.iva_retenido, 40)

console.log('cfdiParser.retenciones.test.ts: ok')
