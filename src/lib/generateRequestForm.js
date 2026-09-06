// Generates a "Facility/Equipment Use Request Form" Word document from an
// approved reservation and triggers a browser download. This builds the
// .docx entirely from scratch client-side using the `docx` package — it
// does NOT fill an existing template and does NOT evaluate any strings as
// JavaScript, so it works cleanly under a strict CSP (script-src 'self',
// no 'unsafe-eval'). No public/templates/*.docx file is needed anymore.
//
// Requires: npm install docx

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  VerticalAlign,
} from 'docx';

const CHECKED = '☒';
const UNCHECKED = '☐';

const formatDate = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Build the plain-data object used to render the form.
 * `reservation` should come from a query that joins laboratories(...)
 * and reservation_equipment(quantity_reserved, equipment(name)).
 */
export const buildRequestFormData = (reservation) => {
  const members = Array.isArray(reservation.members_list) ? reservation.members_list : [];
  const allNames = [reservation.researcher_name, ...members].filter(Boolean).join(', ');

  const labLabel = reservation.laboratories
    ? `${reservation.laboratories.lab_name} (${reservation.laboratories.lab_code})`
    : '';

  const equipmentItems = (reservation.reservation_equipment || []).map((re) => ({
    particular: re.equipment?.name || 'Equipment',
    quantity: String(re.quantity_reserved ?? ''),
    knowledge: '',
    startDate: formatDate(reservation.start_datetime),
    endDate: formatDate(reservation.end_datetime),
  }));

  const items = [
    {
      particular: `Laboratory use — ${reservation.laboratories?.lab_name || ''}`,
      quantity: '1',
      knowledge: '',
      startDate: formatDate(reservation.start_datetime),
      endDate: formatDate(reservation.end_datetime),
    },
    ...equipmentItems,
  ];

  return {
    name: allNames,
    contact: reservation.phone ? String(reservation.phone) : '',
    email: reservation.email || '',
    address: 'N/A',
    unit: reservation.unit_college || '',
    adviser: reservation.adviser_name || '',
    title: reservation.study_title || '',
    labsSummary: labLabel,
    isStudent: reservation.stakeholder_type === 'student',
    isFaculty: reservation.stakeholder_type === 'faculty_staff',
    isNonCvsu: reservation.stakeholder_type === 'non_cvsu',
    items,
  };
};

// ---- Low-level docx building helpers -------------------------------------

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 };
const SHADE = { fill: 'D9D9D9', type: ShadingType.CLEAR, color: 'auto' };

const cell = (children, { width, colSpan, shaded, valign } = {}) =>
  new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: colSpan,
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    shading: shaded ? SHADE : undefined,
    verticalAlign: valign,
    children,
  });

const textPara = (text, opts = {}) =>
  new Paragraph({
    alignment: opts.align,
    children: [new TextRun({ text: text || '', bold: opts.bold, italics: opts.italics, size: opts.size })],
  });

const sectionHeaderRow = (label, colSpanTotal) =>
  new TableRow({
    children: [cell([textPara(label, { bold: true })], { colSpan: colSpanTotal, shaded: true })],
  });

const labelValueRow = (label, value, { labelWidth = 32 } = {}) =>
  new TableRow({
    children: [
      cell([textPara(label, { bold: true })], { width: labelWidth }),
      cell([textPara(value)], { width: 100 - labelWidth }),
    ],
  });

const buildStakeholderTable = (data) => {
  const stakeholderLine =
    `CvSU Stakeholder:   ${data.isStudent ? CHECKED : UNCHECKED} Student   ` +
    `${data.isFaculty ? CHECKED : UNCHECKED} Faculty/Staff        ` +
    `${data.isNonCvsu ? CHECKED : UNCHECKED} Non-CvSU Stakeholder:`;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeaderRow('STAKEHOLDER INFORMATION', 2),
      labelValueRow('Name(s):', data.name),
      labelValueRow('Contact Number:', data.contact),
      labelValueRow('Email Address:', data.email),
      labelValueRow('Address:', data.address),
      new TableRow({
        children: [cell([textPara(stakeholderLine)], { colSpan: 2 })],
      }),
      labelValueRow('Unit / College / Agency:', data.unit),
      labelValueRow('Name of Adviser / Supervisor / Project Leader (if applicable):', data.adviser, { labelWidth: 45 }),
      labelValueRow('Title of the Study/Activity:', data.title),
      labelValueRow('Laboratories / Facilities Requested:', data.labsSummary, { labelWidth: 45 }),
    ],
  });
};

const buildEquipmentTable = (data) => {
  const headerCells = ['Particulars', 'Quantity', 'Knowledge\n(Low/Medium/High/None)', 'Start Date', 'End Date', 'Remarks'];
  const widths = [34, 10, 16, 13, 13, 14];

  const headerRow = new TableRow({
    children: headerCells.map((h, i) =>
      cell([textPara(h, { bold: true, align: AlignmentType.CENTER })], { width: widths[i], valign: VerticalAlign.CENTER })
    ),
  });

  const dataRows = data.items.map(
    (item) =>
      new TableRow({
        children: [
          cell([textPara(item.particular)], { width: widths[0] }),
          cell([textPara(item.quantity, { align: AlignmentType.CENTER })], { width: widths[1] }),
          cell([textPara(item.knowledge, { align: AlignmentType.CENTER })], { width: widths[2] }),
          cell([textPara(item.startDate, { align: AlignmentType.CENTER })], { width: widths[3] }),
          cell([textPara(item.endDate, { align: AlignmentType.CENTER })], { width: widths[4] }),
          cell([textPara('')], { width: widths[5] }),
        ],
      })
  );

  // Pad with a couple of blank rows so the table doesn't look cramped.
  const blankRowsNeeded = Math.max(0, 3 - data.items.length);
  for (let i = 0; i < blankRowsNeeded; i += 1) {
    dataRows.push(
      new TableRow({
        children: widths.map((w) => cell([textPara('')], { width: w })),
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeaderRow('FACILITY / EQUIPMENT REQUESTED*', 6),
      new TableRow({
        children: [cell([textPara('Laboratory/Facility:', { bold: true }), textPara(data.labsSummary)], { colSpan: 6 })],
      }),
      headerRow,
      ...dataRows,
    ],
  });
};

const buildDocument = (data) =>
  new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'FACILITY/EQUIPMENT USE REQUEST FORM', bold: true, size: 28 })],
          }),
          new Paragraph({ text: '' }),
          buildStakeholderTable(data),
          new Paragraph({ text: '' }),
          buildEquipmentTable(data),
          new Paragraph({ text: '' }),
          textPara(
            '*use supplemental page(s) when number of requested equipment exceeds the number of rows or when requesting for multiple laboratories / facilities.',
            { italics: true, size: 18 }
          ),
          new Paragraph({ text: '' }),
          textPara(
            'By signing this request form, we hereby understand, conform and agree to the terms and conditions of the use of Research Center facilities:',
            { bold: true, align: AlignmentType.CENTER }
          ),
        ],
      },
    ],
  });

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/**
 * Build a "Facility/Equipment Use Request Form" for the given reservation
 * and download it as a .docx file the user can keep as a softcopy.
 */
export const downloadRequestForm = async (reservation) => {
  const data = buildRequestFormData(reservation);
  const doc = buildDocument(data);
  const blob = await Packer.toBlob(doc);

  const filename = `UREC-QF-28_RC${String(reservation.id).padStart(5, '0')}_${(reservation.researcher_name || 'request').replace(/\s+/g, '_')}.docx`;
  downloadBlob(blob, filename);
};