const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber,
  UnderlineType
} = require('docx');
const fs = require('fs');

// The logo data - ensure the path is absolute and points to the extracted original logo
const logoData = fs.readFileSync('/Users/clawd/.openclaw/workspace/unpacked_original/word/media/68cff95215ab9aebaca92ccb8863946951422357.png');

const GREEN  = "00A64F";
const NAVY   = "1B365D";
const LGREEN = "E8F5EE";
const LNAVY  = "EBF0F8";
const RED_F  = "C00000";
const YELLOW = "FFF9E6";
const LGRAY  = "F5F5F5";
const ORANGE = "FFF3E0";

const bdr  = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };
const noBdr  = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBdrs = { top: noBdr, bottom: noBdr, left: noBdr, right: noBdr };

const sp = (before=60, after=60) => ({ before, after });
const fnt = (size=20, bold=false, color=undefined, italics=false) =>
  ({ size, bold, font:"Calibri", ...(color?{color}:{}), ...(italics?{italics}:{}) });

function hr() {
  return new Paragraph({ border:{ bottom:{ style:BorderStyle.SINGLE, size:10, color:GREEN }},
    spacing:sp(80,80), children:[] });
}
function h1(t) {
  return new Paragraph({ spacing:sp(280,120), children:[new TextRun({text:t,...fnt(28,true,NAVY)})] });
}
function h2(t) {
  return new Paragraph({ spacing:sp(200,80), children:[new TextRun({text:t,...fnt(24,true,GREEN)})] });
}
function h3(t) {
  return new Paragraph({ spacing:sp(160,60), children:[new TextRun({text:t,...fnt(22,true,NAVY), underline:{type:UnderlineType.SINGLE}})] });
}
function p(t, opts={}) {
  return new Paragraph({ spacing:sp(), children:[new TextRun({text:t,...fnt(20),...opts})] });
}
function bul(t, bold=false, lv=0) {
  return new Paragraph({ numbering:{reference:"bullets", level:lv}, spacing:sp(40,40), children:[new TextRun({text:t,...fnt(20,bold)})] });
}
function num(t, bold=false) {
  return new Paragraph({ numbering:{reference:"numbers", level:0}, spacing:sp(40,40), children:[new TextRun({text:t,...fnt(20,bold)})] });
}
function nota(label, t, fillColor=YELLOW) {
  return new Paragraph({ spacing:sp(80,80), shading:{type:ShadingType.CLEAR, fill:fillColor},
    children:[new TextRun({text:label+" ",...fnt(20,true,"996600")}), new TextRun({text:t,...fnt(20)})]});
}
function incidencia(t) {
  return new Paragraph({ spacing:sp(80,80), shading:{type:ShadingType.CLEAR, fill:ORANGE},
    children:[new TextRun({text:"⚠️ INCIDENCIA DE SISTEMA — ",...fnt(20,true,"B85C00")}), new TextRun({text:t,...fnt(20,true,"B85C00")})]});
}
function secHdr(t) {
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:[9360],
    rows:[new TableRow({ children:[new TableCell({
      borders:noBdrs, shading:{type:ShadingType.CLEAR, fill:NAVY},
      margins:{top:120,bottom:120,left:200,right:200},
      children:[new Paragraph({ spacing:sp(0,0), children:[new TextRun({text:t,...fnt(24,true,"FFFFFF")})] })]
    })]})]
  });
}
function empty() { return new Paragraph({ spacing:sp(40,40), children:[new TextRun({text:""})] }); }

function mkCell(t, w, fill, bold=false, color=undefined) {
  return new TableCell({ borders:bdrs, width:{size:w, type:WidthType.DXA},
    shading:{type:ShadingType.CLEAR, fill}, margins:{top:80,bottom:80,left:120,right:120},
    children:[new Paragraph({spacing:sp(0,0), children:[new TextRun({text:t,...fnt(19,bold,color)})] })]
  });
}

function sanctionTable(rows) {
  const cols = [3400,2600,3360];
  const hdrRow = new TableRow({ children:[
    mkCell("Incumplimiento / Falta", cols[0], NAVY, true, "FFFFFF"),
    mkCell("Rol Responsable", cols[1], NAVY, true, "FFFFFF"),
    mkCell("Consecuencia Automática", cols[2], NAVY, true, "FFFFFF"),
  ]});
  const dRows = rows.map(([a,b,c],i) => new TableRow({ children:[
    mkCell(a, cols[0], i%2===0?LGRAY:"FFFFFF"),
    mkCell(b, cols[1], i%2===0?LGRAY:"FFFFFF"),
    mkCell(c, cols[2], i%2===0?LGRAY:"FFFFFF", true),
  ]}));
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:cols, rows:[hdrRow, ...dRows] });
}

function sigRow() {
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:[4680,4680],
    rows:[new TableRow({ children:[
      new TableCell({ borders:noBdrs, width:{size:4680,type:WidthType.DXA}, margins:{top:60,bottom:60,left:100,right:100},
        children:[p("Nombre: ______________________________________"), p("Puesto:  ______________________________________"),
                  p("Fecha:   ______________________________________"), p("Firma:   ______________________________________")] }),
      new TableCell({ borders:noBdrs, width:{size:4680,type:WidthType.DXA}, margins:{top:60,bottom:60,left:100,right:100},
        children:[p("Nombre: ______________________________________"), p("Puesto:  ______________________________________"),
                  p("Fecha:   ______________________________________"), p("Firma:   ______________________________________")] }),
    ]})]
  });
}

function makeHeader(title, codeInfo) {
  return new Header({ children:[
    new Table({ width:{size:100,type:WidthType.PERCENTAGE}, columnWidths:[2500,6860],
      rows:[new TableRow({ children:[
        new TableCell({ borders:noBdrs, width:{size:2500,type:WidthType.DXA}, verticalAlign:VerticalAlign.CENTER,
          margins:{top:40,bottom:40,left:0,right:100},
          children:[new Paragraph({children:[new ImageRun({type:"png",data:logoData,
            transformation:{width:128,height:61}, altText:{title:"DC",description:"Logo",name:"logo"}})]})] }),
        new TableCell({ borders:noBdrs, width:{size:6860,type:WidthType.DXA}, verticalAlign:VerticalAlign.CENTER,
          shading:{type:ShadingType.CLEAR,fill:NAVY}, margins:{top:80,bottom:80,left:180,right:180},
          children:[
            new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:"DC CONCRETOS, S.A. DE C.V.",...fnt(22,true,"FFFFFF")})]}),
            new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:codeInfo,...fnt(17,false,"FFFFFF")})]}),
            new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:title,...fnt(20,true,GREEN)})]}),
          ] }),
      ]})]
    })
  ]});
}

function makeFooter() {
  return new Footer({ children:[
    new Paragraph({ border:{top:{style:BorderStyle.SINGLE,size:8,color:GREEN}}, alignment:AlignmentType.CENTER, spacing:{before:80},
      children:[
        new TextRun({text:"✉ rh@dcconcretos.com.mx | 🌐 www.dcconcretos.com.mx | Página ",...fnt(18,false,"666666")}),
        new TextRun({children:[PageNumber.CURRENT],...fnt(18,false,"666666")}),
      ]})
  ]});
}

function generateDocument(filename, title, codeInfo, docVersion, contentChildren) {
    const doc = new Document({
      numbering: {
        config: [
          { reference: "bullets", levels: [{ level:0, format:LevelFormat.BULLET, text:"•", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:720,hanging:360}}} }]},
          { reference: "numbers", levels: [{ level:0, format:LevelFormat.DECIMAL, text:"%1.", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:720,hanging:360}}} }]},
        ]
      },
      sections: [{
        properties: { page: { size:{width:12240,height:15840}, margin:{top:1440,right:1080,bottom:1440,left:1080} } },
        headers: { default: makeHeader(title, codeInfo) },
        footers: { default: makeFooter() },
        children: [
          new Paragraph({ alignment:AlignmentType.CENTER, spacing:sp(180,60), children:[new TextRun({text:title,...fnt(36,true,NAVY)})] }),
          new Paragraph({ alignment:AlignmentType.CENTER, spacing:sp(0,200), children:[new TextRun({text:docVersion,...fnt(22,false,GREEN)})] }),
          hr(),
          ...contentChildren,
          empty(),
          new Paragraph({ alignment:AlignmentType.CENTER, spacing:sp(200,60), children:[new TextRun({text:"DC Concretos, S.A. de C.V.",...fnt(20,true,NAVY)})] }),
          new Paragraph({ alignment:AlignmentType.CENTER, spacing:sp(0,60), children:[new TextRun({text:"“Ayudando a concretar ideas”",...fnt(18,false,GREEN,true)})] }),
        ]
      }]
    });

    Packer.toBuffer(doc).then(buf => {
      fs.writeFileSync(filename, buf);
      console.log(`${filename} generado correctamente.`);
    });
}

module.exports = {
    generateDocument, h1, h2, h3, p, bul, num, nota, incidencia, secHdr, empty, sanctionTable, sigRow, hr, mkCell, NAVY, GREEN, LGREEN, LNAVY, RED_F, YELLOW, LGRAY, ORANGE
};
