// Generates a "Facility/Equipment Use Request Form" Word document from an
// approved reservation and triggers a browser download. This builds the
// .docx entirely from scratch client-side using the `docx` package — it
// does NOT fill an existing template and does NOT evaluate any strings as
// JavaScript, so it works cleanly under a strict CSP (script-src 'self',
// no 'unsafe-eval'). No public/templates/*.docx file is needed anymore.
//
// Layout mirrors the official UREC-QF-28 paper form: Republic/university
// header with the CvSU seal, Research Center title block, the stakeholder
// and facility/equipment tables, and the signature / endorsement /
// approval blocks at the bottom.
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
  ImageRun,
} from 'docx';

import cvsuLogo from '@/assets/cvsu-logo.png';
import researchCenterLogo from '@/assets/research-center-logo.png';

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

/**
 * Build the plain-data object for an equipment-only batch — an array of
 * `equipment_reservations` rows that share the same requester/schedule
 * (typically all rows with the same batch_id, or a single row when the
 * user only reserved one item). No laboratory reservation is involved.
 */
export const buildEquipmentBatchFormData = (rows) => {
  const first = rows[0] || {};

  const items = rows.map((r) => ({
    particular: r.equipment?.name || 'Equipment',
    quantity: String(r.quantity_reserved ?? ''),
    knowledge: '',
    startDate: formatDate(r.start_datetime),
    endDate: formatDate(r.end_datetime),
  }));

  const labNames = [...new Set(rows.map((r) => r.equipment?.laboratories?.lab_name).filter(Boolean))];

  return {
    name: first.researcher_name || '',
    contact: first.phone ? String(first.phone) : '',
    email: first.email || '',
    address: 'N/A',
    unit: first.unit_college || '',
    adviser: first.adviser_name || '',
    title: first.study_title || '',
    labsSummary: labNames.join(', '),
    isStudent: first.stakeholder_type === 'student',
    isFaculty: first.stakeholder_type === 'faculty_staff',
    isNonCvsu: first.stakeholder_type === 'non_cvsu',
    items,
  };
};

/**
 * Build the plain-data object for a multi-laboratory batch — an array of
 * `reservations` rows (each with its own laboratory_id/schedule and any
 * `reservation_equipment` attached to it) that share the same batch_id
 * because they were all submitted together in one request.
 */
export const buildLabBatchFormData = (rows) => {
  const first = rows[0] || {};
  const members = Array.isArray(first.members_list) ? first.members_list : [];
  const allNames = [first.researcher_name, ...members].filter(Boolean).join(', ');

  const items = rows.flatMap((r) => {
    const equipmentItems = (r.reservation_equipment || []).map((re) => ({
      particular: re.equipment?.name || 'Equipment',
      quantity: String(re.quantity_reserved ?? ''),
      knowledge: '',
      startDate: formatDate(r.start_datetime),
      endDate: formatDate(r.end_datetime),
    }));

    return [
      {
        particular: `Laboratory use — ${r.laboratories?.lab_name || ''}`,
        quantity: '1',
        knowledge: '',
        startDate: formatDate(r.start_datetime),
        endDate: formatDate(r.end_datetime),
      },
      ...equipmentItems,
    ];
  });

  const labsSummary = [...new Set(rows.map((r) => r.laboratories?.lab_name).filter(Boolean))].join(', ');

  return {
    name: allNames,
    contact: first.phone ? String(first.phone) : '',
    email: first.email || '',
    address: 'N/A',
    unit: first.unit_college || '',
    adviser: first.adviser_name || '',
    title: first.study_title || '',
    labsSummary,
    isStudent: first.stakeholder_type === 'student',
    isFaculty: first.stakeholder_type === 'faculty_staff',
    isNonCvsu: first.stakeholder_type === 'non_cvsu',
    items,
  };
};

// ---- Low-level docx building helpers -------------------------------------

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 };
const SHADE = { fill: 'D9D9D9', type: ShadingType.CLEAR, color: 'auto' };

const cell = (children, { width, colSpan, shaded, valign, borders } = {}) =>
  new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: colSpan,
    borders: borders || CELL_BORDERS,
    margins: CELL_MARGINS,
    shading: shaded ? SHADE : undefined,
    verticalAlign: valign,
    children,
  });

const textPara = (text, opts = {}) =>
  new Paragraph({
    alignment: opts.align,
    spacing: opts.spacing,
    children: [
      new TextRun({
        text: text || '',
        bold: opts.bold,
        italics: opts.italics,
        size: opts.size,
        underline: opts.underline ? {} : undefined,
      }),
    ],
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

// ---- Header: Republic / University / Research Center title block --------

const loadImageBuffer = async (src) => {
  try {
    const res = await fetch(src);
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
};

const buildLetterhead = async () => {
  const cvsuLogoBuffer = await loadImageBuffer(cvsuLogo);
  const researchCenterLogoBuffer = await loadImageBuffer(researchCenterLogo);

  const logoCell = (logoBuffer) =>
    cell(
      [
        logoBuffer
          ? new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: logoBuffer,
                  transformation: { width: 62, height: 55 },
                }),
              ],
            })
          : textPara(''),
      ],
      { width: 15, valign: VerticalAlign.CENTER, borders: NO_BORDERS }
    );

  const centerTextCell = () =>
    cell(
      [
        textPara('Republic of the Philippines', { align: AlignmentType.CENTER, size: 18 }),
        textPara('CAVITE STATE UNIVERSITY', { align: AlignmentType.CENTER, bold: true, size: 30 }),
        textPara('Don Severino de las Alas Campus', { align: AlignmentType.CENTER, size: 18 }),
        textPara('Indang, Cavite', { align: AlignmentType.CENTER, size: 18 }),
        textPara('(046) 862-1854', { align: AlignmentType.CENTER, size: 16 }),
        textPara('researchcenter@cvsu.edu.ph', { align: AlignmentType.CENTER, size: 16 }),
      ],
      { width: 70, valign: VerticalAlign.CENTER, borders: NO_BORDERS }
    );

  const letterheadTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [logoCell(cvsuLogoBuffer), centerTextCell(), logoCell(researchCenterLogoBuffer)],
      }),
    ],
  });

  return [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'UREC-QF-28', size: 16 })],
    }),
    letterheadTable,
    new Paragraph({ text: '' }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'RESEARCH CENTER', bold: true, size: 26 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Technical Services Division', size: 20 })],
    }),
    new Paragraph({ text: '' }),
  ];
};

// ---- Stakeholder / facility tables (unchanged content, same as before) ---

const buildStakeholderTable = (data) => {
  const isCvsuStakeholder = data.isStudent || data.isFaculty;
  const stakeholderLine =
    `${isCvsuStakeholder ? CHECKED : UNCHECKED} CvSU Stakeholder:   ${data.isStudent ? CHECKED : UNCHECKED} Student   ` +
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
  const headerCells = [
    'Particulars',
    'Quantity',
    'Knowledge\n(Low/Medium/High/None)',
    'Start Date',
    'End Date',
    'Remarks\n(To be filled up by Research Center staff)',
  ];
  const widths = [34, 10, 16, 13, 13, 14];

  const headerRow = new TableRow({
    children: headerCells.map((h, i) => {
      const lines = h.split('\n');
      return cell(
        lines.map((line, li) =>
          textPara(line, {
            bold: li === 0,
            italics: li > 0,
            size: li > 0 ? 14 : undefined,
            align: AlignmentType.CENTER,
          })
        ),
        { width: widths[i], valign: VerticalAlign.CENTER }
      );
    }),
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

// ---- Signature / endorsement / approval blocks ---------------------------

const signatureLineCell = (label, { width = 50 } = {}) =>
  cell(
    [
      textPara('', { spacing: { before: 200 } }),
      textPara('_______________________________', { align: AlignmentType.CENTER }),
      textPara(label, { align: AlignmentType.CENTER, bold: true }),
      textPara(''),
      textPara('Date: _____________________'),
    ],
    { width, borders: NO_BORDERS }
  );

const buildStakeholderSupervisorSignatures = () =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [signatureLineCell('Stakeholder(s)'), signatureLineCell('Supervisor')],
      }),
    ],
  });

const shortSignatureRow = (nameLabel, dateLabel, { nameWidth = 65 } = {}) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell([textPara('_______________________________', { align: AlignmentType.CENTER })], {
            width: nameWidth,
            borders: NO_BORDERS,
          }),
          cell([textPara('_______________', { align: AlignmentType.CENTER })], {
            width: 100 - nameWidth,
            borders: NO_BORDERS,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell([textPara(nameLabel, { align: AlignmentType.CENTER, bold: true })], {
            width: nameWidth,
            borders: NO_BORDERS,
          }),
          cell([textPara(dateLabel, { align: AlignmentType.CENTER, bold: true })], {
            width: 100 - nameWidth,
            borders: NO_BORDERS,
          }),
        ],
      }),
    ],
  });

const buildApprovalSection = () => [
  textPara('To be filled by Research Center Staff:', { bold: true }),
  new Paragraph({
    spacing: { before: 120, after: 120 },
    children: [new TextRun({ text: `${UNCHECKED} Approved        ${UNCHECKED} Disapproved        ${UNCHECKED} Others:` })],
  }),
  textPara('Remarks: ________________________________________________________________'),
  new Paragraph({ text: '' }),
];

// ---- Full document assembly -----------------------------------------------

const buildDocument = (data, letterheadChildren) =>
  new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          ...letterheadChildren,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'FACILITY/EQUIPMENT USE REQUEST FORM', bold: true, size: 26 })],
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
          new Paragraph({ text: '' }),
          buildStakeholderSupervisorSignatures(),
          new Paragraph({ text: '' }),
          textPara('Endorsed by:', { align: AlignmentType.CENTER }),
          new Paragraph({ text: '' }),
          shortSignatureRow('Department Chair / Director', 'Date'),
          new Paragraph({ text: '' }),
          ...buildApprovalSection(),
          shortSignatureRow('Director for Research', 'Date'),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'vxx-yyyy-mm-dd', italics: true, size: 16 })],
          }),
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
  const letterheadChildren = await buildLetterhead();
  const doc = buildDocument(data, letterheadChildren);
  const blob = await Packer.toBlob(doc);

  const filename = `UREC-QF-28_RC${String(reservation.id).padStart(5, '0')}_${(reservation.researcher_name || 'request').replace(/\s+/g, '_')}.docx`;
  downloadBlob(blob, filename);
};

/**
 * Build a "Facility/Equipment Use Request Form" for an equipment-only batch
 * (one or more `equipment_reservations` rows sharing the same batch_id) and
 * download it as a single .docx file, referenced by the lowest row ID in
 * the batch.
 */
export const downloadEquipmentRequestForm = async (rows) => {
  const data = buildEquipmentBatchFormData(rows);
  const letterheadChildren = await buildLetterhead();
  const doc = buildDocument(data, letterheadChildren);
  const blob = await Packer.toBlob(doc);

  const refId = Math.min(...rows.map((r) => r.id));
  const filename = `UREC-QF-28_EQ${String(refId).padStart(5, '0')}_${(rows[0]?.researcher_name || 'request').replace(/\s+/g, '_')}.docx`;
  downloadBlob(blob, filename);
};

/**
 * Build a "Facility/Equipment Use Request Form" for a multi-laboratory batch
 * (one or more `reservations` rows sharing the same batch_id) and download
 * it as a single .docx file, referenced by the lowest row ID in the batch.
 */
export const downloadLabBatchRequestForm = async (rows) => {
  const data = buildLabBatchFormData(rows);
  const letterheadChildren = await buildLetterhead();
  const doc = buildDocument(data, letterheadChildren);
  const blob = await Packer.toBlob(doc);

  const refId = Math.min(...rows.map((r) => r.id));
  const filename = `UREC-QF-28_RC${String(refId).padStart(5, '0')}_${(rows[0]?.researcher_name || 'request').replace(/\s+/g, '_')}.docx`;
  downloadBlob(blob, filename);
};